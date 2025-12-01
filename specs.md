# Kubernetes HPA Simulator (Custom Metric) - Product Specs

## 1. Goal

Build a **single-page web simulator** that mimics **Kubernetes HPA (autoscaling/v2)** behavior when scaling on a **custom metric = queue latency**.

The app simulates **second-by-second**:
* Queue length
* Queue latency
* HPA replica count

And shows:
* **Chart 1:** Queue latency (seconds) vs time (seconds)
* **Chart 2:** Replica count vs time (seconds)
* **Chart 3:** Queue length vs time (seconds)

## 2. Scope

### In Scope
* Deterministic, discrete-time simulation (1-second ticks).
* Single custom metric: **queue latency (seconds)**.
* HPA-like scaling rules:
  * HPA core formula: `desiredReplicas = ceil(currentReplicas * currentMetricValue / desiredMetricValue)`
  * `minPods` / `maxPods` constraints.
  * `tolerance` (default 0.1).
* Advanced HPA `behavior` configuration:
  * `stabilizationWindowSeconds` (Scale Up and Scale Down).
  * `selectPolicy` (Max / Min / Disabled).
  * `policies` (Pods / Percent with `periodSeconds`).

### Out of Scope
* Real metrics APIs or k8s cluster connection.
* Pod readiness delays, CPU initialization, missing metrics.
* Multi-metric interactions.
* Measurement lag.

## 3. Input Parameters

### Core Simulation
1. **Min Pods** (integer ≥ 1)
2. **Max Pods** (integer ≥ minPods)
3. **Starting Pods** (integer)
4. **Starting Jobs in Queue** (integer ≥ 0)
5. **Starting Queue Latency** (float ≥ 0, authoritative only if Queue=0)
6. **Job processing rate per pod** (jobs / second / pod)
7. **Job producing rate total** (jobs / second total)
8. **Seconds to simulate** (integer > 0)
9. **Target latency value** (float > 0)
10. **Tolerance** (float, default 0.1)

### Autoscaling Behavior (Up & Down)
* **Stabilization Window**: Seconds to look back for recommendation history.
  * Scale Up: Uses **Minimum** of window (Conservative).
  * Scale Down: Uses **Maximum** of window (Conservative).
* **Select Policy**:
  * `Max`: Select the policy that allows the most change.
  * `Min`: Select the policy that allows the least change.
  * `Disabled`: Prevent scaling in this direction.
* **Policies**: List of rules.
  * Type: `Pods` (absolute) or `Percent` (relative).
  * Value: Amount to change.
  * Period: Seconds window for the rate limit.

## 4. Simulation Model

**State per second (`t`):**
1.  **Production/Processing**:
    *   `arrivals = producingRate`
    *   `capacity = currentPods * processingRate`
    *   `processed = min(queue + arrivals, capacity)`
    *   `newQueue = queue + arrivals - processed`
2.  **Metric Calculation**:
    *   `latency = newQueue / capacity`
3.  **HPA Calculation**:
    *   `rawDesired = ceil(currentPods * (latency / target))`
    *   Apply `tolerance` (if within tolerance, `rawDesired = currentPods`).
    *   Clamp to `minPods` / `maxPods`.
4.  **Stabilization**:
    *   Look back `stabilizationWindowSeconds`.
    *   Apply Min/Max logic based on direction to find `stabilizedRecommendation`.
5.  **Policies**:
    *   Calculate allowed change based on `policies` (Pods/Percent) relative to pods `periodSeconds` ago.
    *   Apply `selectPolicy` (Min/Max) to combine policies.
    *   Clamp `stabilizedRecommendation` to the allowed change limit.
6.  **Final Update**:
    *   Update `currentPods` for `t+1`.

## 5. UI / UX

*   **Left Panel**: Configuration Form (Tabs for Workload, Scale Up, Scale Down).
*   **Right Panel**: 
    *   Key Metrics Summary (Max Latency, Final Pods, etc.).
    *   Interactive Charts (Recharts).
*   **Tech Stack**: React + TypeScript + Tailwind CSS.
