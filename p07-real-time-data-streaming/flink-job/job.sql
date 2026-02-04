-- =============================================================================
-- Flink SQL Job: IoT Sensor Tumbling Window Aggregation
--
-- This job reads raw IoT sensor data from the 'sensors' Kafka topic, performs
-- a 1-minute tumbling window aggregation grouped by device_id, and writes the
-- aggregated results to the 'aggregated' Kafka topic.
--
-- Prerequisites:
--   - Kafka topics 'sensors' and 'aggregated' must exist.
--   - Flink cluster must have the flink-sql-connector-kafka JAR available.
--
-- Usage:
--   Submit via the Flink SQL Client:
--     docker exec -it flink-jobmanager ./bin/sql-client.sh
--   Then paste the contents of this file.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Source Table — raw sensor readings from Kafka
-- ---------------------------------------------------------------------------
CREATE TABLE sensor_readings (
    reading_id   STRING,
    device_id    STRING,
    temperature  DOUBLE,
    humidity     DOUBLE,
    `timestamp`  TIMESTAMP(3),

    -- Declare event-time attribute with watermark tolerance for late arrivals
    WATERMARK FOR `timestamp` AS `timestamp` - INTERVAL '10' SECOND
) WITH (
    'connector'                  = 'kafka',
    'topic'                      = 'sensors',
    'properties.bootstrap.servers' = 'kafka:29092',
    'properties.group.id'        = 'flink-sensor-aggregation',
    'scan.startup.mode'          = 'latest-offset',
    'format'                     = 'json',
    'json.fail-on-missing-field' = 'false',
    'json.ignore-parse-errors'   = 'true'
);

-- ---------------------------------------------------------------------------
-- 2. Sink Table — aggregated metrics written back to Kafka
-- ---------------------------------------------------------------------------
CREATE TABLE aggregated_metrics (
    window_start   TIMESTAMP(3),
    window_end     TIMESTAMP(3),
    device_id      STRING,
    reading_count  BIGINT,
    avg_temperature DOUBLE,
    min_temperature DOUBLE,
    max_temperature DOUBLE,
    avg_humidity   DOUBLE,
    min_humidity   DOUBLE,
    max_humidity   DOUBLE,

    PRIMARY KEY (window_start, window_end, device_id) NOT ENFORCED
) WITH (
    'connector'                    = 'upsert-kafka',
    'topic'                        = 'aggregated',
    'properties.bootstrap.servers' = 'kafka:29092',
    'key.format'                   = 'json',
    'value.format'                 = 'json'
);

-- ---------------------------------------------------------------------------
-- 3. Continuous Aggregation Query — 1-minute tumbling windows
-- ---------------------------------------------------------------------------
INSERT INTO aggregated_metrics
SELECT
    window_start,
    window_end,
    device_id,
    COUNT(*)              AS reading_count,
    ROUND(AVG(temperature), 2)  AS avg_temperature,
    MIN(temperature)      AS min_temperature,
    MAX(temperature)      AS max_temperature,
    ROUND(AVG(humidity), 2)     AS avg_humidity,
    MIN(humidity)         AS min_humidity,
    MAX(humidity)         AS max_humidity
FROM TABLE(
    TUMBLE(TABLE sensor_readings, DESCRIPTOR(`timestamp`), INTERVAL '1' MINUTE)
)
GROUP BY
    window_start,
    window_end,
    device_id;
