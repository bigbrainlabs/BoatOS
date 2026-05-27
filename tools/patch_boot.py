#!/usr/bin/env python3
"""
patch_boot.py - Adds files to FAT32 boot partition in a Pi disk image.
Adds os_customisation_enabled, firstrun.sh, wlan.txt and updates cmdline.txt.
No external dependencies required.
"""

import struct
import sys
import os
import time

IMG = sys.argv[1] if len(sys.argv) > 1 else \
    r"C:\Users\bigbr\Documents\ProjekteBoot\boatos_v1.5.11_patched.img"

TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))

FILES_TO_ADD = {
    "os_customisation_enabled": b"",
    "firstrun.sh": open(os.path.join(TOOLS_DIR, "firstrun.sh"), "rb").read(),
    "wlan.txt": open(os.path.join(TOOLS_DIR, "wlan.txt"), "rb").read(),
}


def parse_mbr(f):
    f.seek(446)
    partitions = []
    for _ in range(4):
        entry = f.read(16)
        ptype = entry[4]
        lba_start = struct.unpack_from("<I", entry, 8)[0]
        lba_size  = struct.unpack_from("<I", entry, 12)[0]
        if lba_start > 0 and lba_size > 0:
            partitions.append((ptype, lba_start, lba_size))
    return partitions


def parse_fat32_bpb(f, part_offset):
    f.seek(part_offset)
    bs = f.read(512)
    bytes_per_sector   = struct.unpack_from("<H", bs, 11)[0]
    sectors_per_cluster= bs[13]
    reserved_sectors   = struct.unpack_from("<H", bs, 14)[0]
    num_fats           = bs[16]
    fat_size_32        = struct.unpack_from("<I", bs, 36)[0]
    root_cluster       = struct.unpack_from("<I", bs, 44)[0]
    return {
        "bps": bytes_per_sector,
        "spc": sectors_per_cluster,
        "reserved": reserved_sectors,
        "num_fats": num_fats,
        "fat_size": fat_size_32,
        "root_cluster": root_cluster,
        "part_offset": part_offset,
        "cluster_size": bytes_per_sector * sectors_per_cluster,
        "fat_offset": part_offset + reserved_sectors * bytes_per_sector,
        "data_offset": part_offset + (reserved_sectors + num_fats * fat_size_32) * bytes_per_sector,
    }


def cluster_to_offset(bpb, cluster):
    return bpb["data_offset"] + (cluster - 2) * bpb["cluster_size"]


def lfn_checksum(sfn_bytes):
    csum = 0
    for b in sfn_bytes:
        csum = ((csum >> 1) | ((csum & 1) << 7)) + b
        csum &= 0xFF
    return csum


def make_sfn(name, existing_sfns):
    """Generate unique 8.3 short filename."""
    name_upper = name.upper().replace(".", "_")
    base = name_upper[:6].ljust(6)
    ext  = b"   "
    for i in range(1, 100):
        candidate = (base + f"~{i}").encode("ascii")[:8]
        candidate = candidate.ljust(8)
        sfn = candidate + ext
        if sfn not in existing_sfns:
            return sfn
    raise ValueError("No SFN slot available")


def make_dir_entries(name, content_size, start_cluster, existing_sfns):
    """Build LFN + SFN directory entries for a file."""
    sfn = make_sfn(name, existing_sfns)
    existing_sfns.add(sfn)
    csum = lfn_checksum(sfn)

    # Encode long filename as UTF-16LE, pad to multiple of 13 chars
    name_utf16 = name.encode("utf-16-le")
    name_chars = list(struct.unpack(f"<{len(name_utf16)//2}H", name_utf16))
    name_chars.append(0x0000)  # null terminator
    while len(name_chars) % 13 != 0:
        name_chars.append(0xFFFF)

    num_lfn = len(name_chars) // 13
    entries = b""

    for i in range(num_lfn, 0, -1):
        chunk = name_chars[(i-1)*13 : i*13]
        seq = i | (0x40 if i == num_lfn else 0)
        part1 = struct.pack("<5H", *chunk[0:5])
        part2 = struct.pack("<6H", *chunk[5:11])
        part3 = struct.pack("<2H", *chunk[11:13])
        lfn_entry = struct.pack("B", seq) + part1 + b"\x0F\x00" + bytes([csum]) + part2 + b"\x00\x00" + part3
        entries += lfn_entry

    now = time.localtime()
    fat_time = (now.tm_hour << 11) | (now.tm_min << 5) | (now.tm_sec // 2)
    fat_date = ((now.tm_year - 1980) << 9) | (now.tm_mon << 5) | now.tm_mday
    hi_cluster = (start_cluster >> 16) & 0xFFFF
    lo_cluster = start_cluster & 0xFFFF

    sfn_entry = (
        sfn[:8] + sfn[8:11] +          # name + ext
        b"\x20" +                        # archive attribute
        b"\x00" +                        # reserved
        b"\x00" +                        # create time tenth
        struct.pack("<HHH", fat_time, fat_date, fat_date) +  # crt time/date, acc date
        struct.pack("<H", hi_cluster) +
        struct.pack("<HH", fat_time, fat_date) +
        struct.pack("<H", lo_cluster) +
        struct.pack("<I", content_size)
    )
    entries += sfn_entry
    return entries


def find_existing_filenames(f, bpb, cluster):
    """Read directory entries from a cluster chain, return (names_set, sfns_set, free_slot_offset)."""
    names = set()
    sfns  = set()
    free_slot = None
    current = cluster
    while current < 0x0FFFFFF8:
        off = cluster_to_offset(bpb, current)
        for i in range(bpb["cluster_size"] // 32):
            entry_off = off + i * 32
            f.seek(entry_off)
            entry = f.read(32)
            if not entry or len(entry) < 32:
                break
            first = entry[0]
            if first == 0x00:
                if free_slot is None:
                    free_slot = entry_off
                break
            if first == 0xE5:
                if free_slot is None:
                    free_slot = entry_off
                continue
            attr = entry[11]
            if attr == 0x0F:  # LFN
                continue
            # SFN
            sfn = entry[:11]
            sfns.add(bytes(sfn))
            raw = entry[:8].rstrip(b" ").decode("ascii", errors="ignore")
            ext = entry[8:11].rstrip(b" ").decode("ascii", errors="ignore")
            names.add((raw + ("." + ext if ext else "")).lower())
        # next cluster
        fat_off = bpb["fat_offset"] + current * 4
        f.seek(fat_off)
        current = struct.unpack("<I", f.read(4))[0] & 0x0FFFFFFF
    return names, sfns, free_slot


def write_entries_to_dir(f, bpb, dir_cluster, entries_bytes):
    """Find enough free consecutive 32-byte slots and write entries."""
    needed = len(entries_bytes) // 32
    current = dir_cluster
    while current < 0x0FFFFFF8:
        off = cluster_to_offset(bpb, current)
        slots_in_cluster = bpb["cluster_size"] // 32
        # Find run of free slots
        run_start = None
        run_count = 0
        for i in range(slots_in_cluster):
            f.seek(off + i * 32)
            first = f.read(1)
            if not first:
                break
            if first[0] in (0x00, 0xE5):
                if run_start is None:
                    run_start = off + i * 32
                run_count += 1
                if run_count >= needed:
                    # Write here
                    f.seek(run_start)
                    f.write(entries_bytes)
                    # If first byte was 0x00, ensure terminator follows
                    if first[0] == 0x00 and run_count == needed:
                        f.seek(run_start + len(entries_bytes))
                        f.write(b"\x00" * 32)
                    return run_start
            else:
                run_start = None
                run_count = 0
        fat_off = bpb["fat_offset"] + current * 4
        f.seek(fat_off)
        current = struct.unpack("<I", f.read(4))[0] & 0x0FFFFFFF
    raise RuntimeError("No free directory space found")


def read_file_from_fat(f, bpb, dir_cluster, target_name):
    """Find file by name in directory, return (content, entry_offset)."""
    current = dir_cluster
    lfn_parts = {}
    while current < 0x0FFFFFF8:
        off = cluster_to_offset(bpb, current)
        for i in range(bpb["cluster_size"] // 32):
            entry_off = off + i * 32
            f.seek(entry_off)
            entry = f.read(32)
            if not entry or entry[0] == 0x00:
                break
            if entry[0] == 0xE5:
                lfn_parts = {}
                continue
            attr = entry[11]
            if attr == 0x0F:  # LFN
                seq = entry[0] & 0x3F
                chars = []
                for pos in [1, 3, 5, 7, 9, 14, 16, 18, 20, 22, 24, 28, 30]:
                    chars.append(struct.unpack_from("<H", entry, pos)[0])
                lfn_parts[seq] = chars
                continue
            # SFN - reconstruct long name
            if lfn_parts:
                name_chars = []
                for seq in sorted(lfn_parts):
                    name_chars.extend(lfn_parts[seq])
                try:
                    name_utf16 = struct.pack(f"<{len(name_chars)}H", *name_chars)
                    full_name = name_utf16.decode("utf-16-le").rstrip("\x00￿")
                except Exception:
                    full_name = ""
            else:
                raw = entry[:8].rstrip(b" ").decode("ascii", errors="ignore")
                ext = entry[8:11].rstrip(b" ").decode("ascii", errors="ignore")
                full_name = raw + ("." + ext if ext else "")
            lfn_parts = {}
            if full_name.lower() == target_name.lower():
                # Read file content
                hi = struct.unpack_from("<H", entry, 20)[0]
                lo = struct.unpack_from("<H", entry, 26)[0]
                start_cluster = (hi << 16) | lo
                size = struct.unpack_from("<I", entry, 28)[0]
                content = b""
                c = start_cluster
                while c < 0x0FFFFFF8 and len(content) < size:
                    f.seek(cluster_to_offset(bpb, c))
                    content += f.read(bpb["cluster_size"])
                    fat_off = bpb["fat_offset"] + c * 4
                    f.seek(fat_off)
                    c = struct.unpack("<I", f.read(4))[0] & 0x0FFFFFFF
                return content[:size], entry_off
        fat_off = bpb["fat_offset"] + current * 4
        f.seek(fat_off)
        current = struct.unpack("<I", f.read(4))[0] & 0x0FFFFFFF
    return None, None


def alloc_cluster(f, bpb):
    """Find a free cluster in FAT, mark as end-of-chain, return cluster number."""
    fat_size_bytes = bpb["fat_size"] * bpb["bps"]
    f.seek(bpb["fat_offset"] + 8)  # start from cluster 2
    for i in range(2, fat_size_bytes // 4):
        f.seek(bpb["fat_offset"] + i * 4)
        val = struct.unpack("<I", f.read(4))[0] & 0x0FFFFFFF
        if val == 0:
            f.seek(bpb["fat_offset"] + i * 4)
            f.write(struct.pack("<I", 0x0FFFFFFF))
            # Also update FAT2
            fat2_off = bpb["fat_offset"] + bpb["fat_size"] * bpb["bps"]
            f.seek(fat2_off + i * 4)
            f.write(struct.pack("<I", 0x0FFFFFFF))
            # Zero out the cluster
            f.seek(cluster_to_offset(bpb, i))
            f.write(b"\x00" * bpb["cluster_size"])
            return i
    raise RuntimeError("FAT full - no free cluster")


def add_file(f, bpb, dir_cluster, filename, content):
    """Add a file to the directory. Overwrites if exists."""
    print(f"  Adding: {filename} ({len(content)} bytes)")

    existing_names, existing_sfns, _ = find_existing_filenames(f, bpb, dir_cluster)

    if filename.lower() in existing_names:
        print(f"    Already exists, skipping.")
        return

    if len(content) == 0:
        start_cluster = 0
    else:
        start_cluster = alloc_cluster(f, bpb)
        f.seek(cluster_to_offset(bpb, start_cluster))
        f.write(content)

    entries = make_dir_entries(filename, len(content), start_cluster, existing_sfns)
    write_entries_to_dir(f, bpb, dir_cluster, entries)


def update_cmdline(f, bpb, dir_cluster):
    """Append systemd.run to cmdline.txt if not already present."""
    content, entry_off = read_file_from_fat(f, bpb, dir_cluster, "cmdline.txt")
    if content is None:
        print("  WARNING: cmdline.txt not found")
        return
    text = content.decode("utf-8", errors="replace").rstrip()
    marker = "systemd.run=/boot/firmware/firstrun.sh"
    if marker in text:
        print("  cmdline.txt: marker already present")
        return
    new_text = text + " " + marker
    new_bytes = new_text.encode("utf-8")

    # Write new content into existing cluster(s)
    # Find start cluster from entry
    f.seek(entry_off)
    entry = f.read(32)
    hi = struct.unpack_from("<H", entry, 20)[0]
    lo = struct.unpack_from("<H", entry, 26)[0]
    start_cluster = (hi << 16) | lo

    if start_cluster == 0 or len(new_bytes) > bpb["cluster_size"]:
        # Need to allocate cluster
        start_cluster = alloc_cluster(f, bpb)
        # Update entry
        f.seek(entry_off + 20)
        f.write(struct.pack("<H", (start_cluster >> 16) & 0xFFFF))
        f.seek(entry_off + 26)
        f.write(struct.pack("<H", start_cluster & 0xFFFF))

    f.seek(cluster_to_offset(bpb, start_cluster))
    f.write(new_bytes.ljust(bpb["cluster_size"], b"\x00"))

    # Update file size in directory entry
    f.seek(entry_off + 28)
    f.write(struct.pack("<I", len(new_bytes)))
    print(f"  cmdline.txt: updated ({len(new_bytes)} bytes)")


def main():
    print(f"Image: {IMG}")
    if not os.path.exists(IMG):
        print("ERROR: Image file not found!")
        sys.exit(1)

    with open(IMG, "r+b") as f:
        partitions = parse_mbr(f)
        print(f"Partitions found: {len(partitions)}")
        for p in partitions:
            print(f"  type=0x{p[0]:02X} lba_start={p[1]} lba_size={p[2]}")

        # Find FAT32 partition (type 0x0B or 0x0C)
        fat_parts = [p for p in partitions if p[0] in (0x0B, 0x0C)]
        if not fat_parts:
            print("ERROR: No FAT32 partition found")
            sys.exit(1)

        ptype, lba_start, lba_size = fat_parts[0]
        part_offset = lba_start * 512
        print(f"Boot partition at offset {part_offset} bytes ({part_offset // 1024 // 1024} MB)")

        bpb = parse_fat32_bpb(f, part_offset)
        print(f"FAT32: {bpb['bps']} B/sector, {bpb['spc']} sectors/cluster, root cluster={bpb['root_cluster']}")

        root_cluster = bpb["root_cluster"]

        print("\nAdding files to boot partition...")
        for name, content in FILES_TO_ADD.items():
            add_file(f, bpb, root_cluster, name, content)

        print("\nUpdating cmdline.txt...")
        update_cmdline(f, bpb, root_cluster)

    print("\nDone. Boot partition patched successfully.")


if __name__ == "__main__":
    main()
