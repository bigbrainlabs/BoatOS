# Setting up tilemaker

All three files must be placed in the same directory as `creator.py`.

## 1. tilemaker.exe

Releases page: https://github.com/systemed/tilemaker/releases

- Choose the latest release
- Download the Windows ZIP (e.g. `tilemaker-windows-amd64.zip`)
- Copy `tilemaker.exe` from the ZIP into this directory

## 2. Configuration files

From the tilemaker repository: https://github.com/systemed/tilemaker

Required files from the `resources/` folder:

- `config-openmaptiles.json`
- `process-openmaptiles.lua`

Copy both files into this directory as well.

## 3. Water polygons (automatic)

The file `water-polygons-split-4326.zip` is downloaded automatically on first launch
and extracted into this directory (~800 MB). Required only once.

## Directory structure afterwards

```
mbtiles-creator/
  creator.py
  requirements.txt
  tilemaker.exe
  config-openmaptiles.json
  process-openmaptiles.lua
  water-polygons-split-4326/   ← created automatically
  tmp/                          ← temporary files (PBF, mbtiles)
```
