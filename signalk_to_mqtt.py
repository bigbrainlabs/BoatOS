#!/usr/bin/env python3
"""
SignalK to MQTT Bridge - Optimized
Reads data from SignalK WebSocket and publishes to MQTT broker
"""
import asyncio
import json
import paho.mqtt.client as mqtt
import websockets
import time
from collections import defaultdict

SIGNALK_WS = "ws://localhost:3000/signalk/v1/stream"
MQTT_HOST = "localhost"
MQTT_PORT = 1883
MQTT_TOPIC_PREFIX = "boat/"
MIN_UPDATE_INTERVAL = 1.0  # Seconds between updates for same topic

mqtt_client = None
last_update_time = defaultdict(float)
last_value = {}
message_count = 0

def on_mqtt_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ Connected to MQTT broker")
    else:
        print(f"⚠️ MQTT connection failed: {rc}")

def should_publish(topic, value, current_time):
    """Rate limiting + deduplication"""
    if current_time - last_update_time[topic] < MIN_UPDATE_INTERVAL:
        return False
    if topic in last_value and last_value[topic] == value:
        return False
    return True

async def signalk_to_mqtt():
    global mqtt_client, message_count

    # Setup MQTT client
    mqtt_client = mqtt.Client(client_id="signalk_mqtt_bridge")
    mqtt_client.on_connect = on_mqtt_connect
    mqtt_client.connect(MQTT_HOST, MQTT_PORT, 60)
    mqtt_client.loop_start()

    print(f"🔌 Connecting to SignalK at {SIGNALK_WS}")

    while True:
        try:
            async with websockets.connect(SIGNALK_WS) as ws:
                print("✅ Connected to SignalK WebSocket")

                async for message in ws:
                    data = json.loads(message)
                    current_time = time.time()

                    # Process SignalK deltas
                    if "updates" in data:
                        for update in data["updates"]:
                            if "values" in update:
                                for value in update["values"]:
                                    path = value.get("path", "")
                                    val = value.get("value")

                                    if path and val is not None:
                                        # Convert path to MQTT topic
                                        mqtt_topic = MQTT_TOPIC_PREFIX + path.replace(".", "/")

                                        # Handle complex values (like position)
                                        if isinstance(val, dict):
                                            # Publish sub-values with rate limiting
                                            for key, subval in val.items():
                                                sub_topic = f"{mqtt_topic}/{key}"
                                                if should_publish(sub_topic, subval, current_time):
                                                    mqtt_client.publish(sub_topic, str(subval))
                                                    last_update_time[sub_topic] = current_time
                                                    last_value[sub_topic] = subval
                                                    message_count += 1
                                        else:
                                            # Publish simple value with rate limiting
                                            if should_publish(mqtt_topic, val, current_time):
                                                mqtt_client.publish(mqtt_topic, str(val))
                                                last_update_time[mqtt_topic] = current_time
                                                last_value[mqtt_topic] = val
                                                message_count += 1

                                    # Print stats every 100 messages (instead of every single message)
                                    if message_count > 0 and message_count % 100 == 0:
                                        print(f"📊 {message_count} messages published")

        except Exception as e:
            print(f"⚠️ Connection error: {e}")
            print("🔄 Reconnecting in 5 seconds...")
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(signalk_to_mqtt())
