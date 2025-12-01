import { SimulatorConfig, SimulationResult, SimulationPoint, ScaleBehavior } from './types';

// Helper to get logic specific value based on policy
const getLimitValue = (
  policyType: 'Pods' | 'Percent', 
  policyValue: number, 
  referencePods: number
): number => {
  if (policyType === 'Pods') {
    return policyValue;
  } else {
    return Math.ceil((referencePods * policyValue) / 100);
  }
};

export const runSimulation = (config: SimulatorConfig): SimulationResult => {
  const points: SimulationPoint[] = [];
  
  // Initialize state
  let currentPods = config.startingPods;
  
  // If queue is 0 but latency is set, infer queue size
  let currentQueue = config.initialQueueJobs;
  if (currentQueue === 0 && config.initialLatencySeconds > 0 && currentPods > 0) {
    currentQueue = Math.ceil(config.initialLatencySeconds * currentPods * config.processingRatePerPod);
  }

  // History for stabilization and policies
  // Maps time (t) to value
  const desiredReplicasHistory: number[] = []; 
  const podHistory: number[] = []; // Stores pod count at each second

  // Pre-fill history for t < 0 to handle initial lookbacks cleanly
  // We assume the state was constant before t=0
  const preFillHistorySize = 3600; // ample buffer
  for (let i = 0; i < preFillHistorySize; i++) {
    desiredReplicasHistory.push(currentPods);
    podHistory.push(currentPods);
  }
  
  // Accessor helpers that handle the offset
  const getDesiredReplicaAt = (t: number) => {
    const idx = t + preFillHistorySize;
    if (idx < 0) return currentPods; 
    return desiredReplicasHistory[Math.min(idx, desiredReplicasHistory.length - 1)];
  };

  const getPodsAt = (t: number) => {
    const idx = t + preFillHistorySize;
    if (idx < 0) return currentPods;
    return podHistory[Math.min(idx, podHistory.length - 1)];
  };

  let scaleUps = 0;
  let scaleDowns = 0;

  for (let t = 0; t <= config.simulationSeconds; t++) {
    // 1. Calculate inputs for this tick
    // Note: Latency is calculated based on start-of-tick state
    let latency = 0;
    const processingCapacity = currentPods * config.processingRatePerPod;
    
    if (currentPods > 0 && config.processingRatePerPod > 0) {
      latency = currentQueue / processingCapacity;
    } else if (currentQueue > 0) {
      latency = 9999; // Infinite latency
    } else {
      latency = 0;
    }

    // 2. Queue Dynamics (Process & Produce)
    const arrivals = config.producingRateTotal; // 1 second interval
    const processed = Math.min(currentQueue + arrivals, processingCapacity);
    const nextQueue = Math.max(0, currentQueue + arrivals - processed);

    // 3. HPA Core Formula
    let desiredReplicasRaw = currentPods;
    const ratio = latency / config.targetLatencySeconds;
    
    // Apply tolerance
    if (Math.abs(ratio - 1.0) > config.toleranceFraction) {
      desiredReplicasRaw = Math.ceil(currentPods * ratio);
    }

    // Initial clamping
    desiredReplicasRaw = Math.min(Math.max(desiredReplicasRaw, config.minPods), config.maxPods);
    
    // Store raw recommendation for stabilization lookback
    desiredReplicasHistory.push(desiredReplicasRaw);

    // 4. Stabilization
    // Determine Scale Direction based on Raw vs Current
    // Note: This logic follows K8s 1.26+ common approach where we check both windows
    
    let stabilizedRecommendation = desiredReplicasRaw;

    // Scale Up Stabilization: Min of window
    // (We use desiredReplicasHistory which includes current 't')
    if (config.scaleUp.stabilizationWindowSeconds > 0) {
      let minInWindow = desiredReplicasRaw;
      for (let i = 0; i <= config.scaleUp.stabilizationWindowSeconds; i++) {
        const val = getDesiredReplicaAt(t - i);
        if (val < minInWindow) minInWindow = val;
      }
      // If our raw intent is to scale up (raw > current), limits apply.
      // If raw < current, we use the raw (which might be handled by down stabilization)
      // Standard algorithm: Calculate separate stabilized proposals.
      if (desiredReplicasRaw > currentPods) {
          stabilizedRecommendation = minInWindow; 
      }
    }

    // Scale Down Stabilization: Max of window
    if (config.scaleDown.stabilizationWindowSeconds > 0) {
      let maxInWindow = desiredReplicasRaw;
      for (let i = 0; i <= config.scaleDown.stabilizationWindowSeconds; i++) {
        const val = getDesiredReplicaAt(t - i);
        if (val > maxInWindow) maxInWindow = val;
      }
      if (desiredReplicasRaw < currentPods) {
        stabilizedRecommendation = maxInWindow;
      }
    }
    
    // If directions conflict or equal, we basically hold or follow the safer path. 
    // Simplified: stabilizedRecommendation is now our target before policies.

    // 5. Apply Policies
    let desiredReplicasEffective = stabilizedRecommendation;
    let direction: 'up' | 'down' | 'none' = 'none';

    if (stabilizedRecommendation > currentPods) {
      direction = 'up';
    } else if (stabilizedRecommendation < currentPods) {
      direction = 'down';
    }

    if (direction === 'up') {
      const behavior = config.scaleUp;
      if (behavior.selectPolicy === 'Disabled') {
        desiredReplicasEffective = currentPods;
      } else {
        const allowedPods: number[] = [];
        // Calculate limit for each policy
        behavior.policies.forEach(policy => {
          // Limit is based on pods 'periodSeconds' ago
          const referencePods = getPodsAt(t - policy.periodSeconds);
          const limitAmount = getLimitValue(policy.type, policy.value, referencePods);
          allowedPods.push(referencePods + limitAmount);
        });

        // If no policies, assumed unbounded (just min/max global)
        // If policies exist, apply SelectPolicy
        if (allowedPods.length > 0) {
          const limit = behavior.selectPolicy === 'Min' 
            ? Math.min(...allowedPods) 
            : Math.max(...allowedPods);
          desiredReplicasEffective = Math.min(stabilizedRecommendation, limit);
        }
      }
    } else if (direction === 'down') {
      const behavior = config.scaleDown;
      if (behavior.selectPolicy === 'Disabled') {
        desiredReplicasEffective = currentPods;
      } else {
        const allowedPods: number[] = [];
        behavior.policies.forEach(policy => {
            const referencePods = getPodsAt(t - policy.periodSeconds);
            const limitAmount = getLimitValue(policy.type, policy.value, referencePods);
            allowedPods.push(Math.max(0, referencePods - limitAmount));
        });

        if (allowedPods.length > 0) {
           // For scale down:
           // 'Max' policy means we allow the MAXIMUM reduction? 
           // NO. 'selectPolicy' chooses which *policy value* to use.
           // However, K8s docs say: "selectPolicy... Min... allows the smallest change in replica count."
           // So for Scale Down:
           //   limit1 (pods=1) -> allows removing 1 pod. Target = Current - 1.
           //   limit2 (percent=10%) -> allows removing 10%. Target = Current * 0.9.
           //   Max policy -> Allows maximum change (remove more). Result is min(Target1, Target2).
           //   Min policy -> Allows minimum change (remove fewer). Result is max(Target1, Target2).
           
           // Let's rephrase in terms of "Resulting Pods":
           // limit1_floor = 10. limit2_floor = 15.
           // "Max" change means going lower. So min(10, 15) = 10.
           // "Min" change means staying higher. So max(10, 15) = 15.
           
           const limit = behavior.selectPolicy === 'Min'
             ? Math.max(...allowedPods) // Minimum change = highest floor
             : Math.min(...allowedPods); // Maximum change = lowest floor
             
           desiredReplicasEffective = Math.max(stabilizedRecommendation, limit);
        }
      }
    }

    // 6. Final Clamping & Update
    desiredReplicasEffective = Math.min(Math.max(desiredReplicasEffective, config.minPods), config.maxPods);
    
    // Check if a scaling event actually happened
    if (desiredReplicasEffective > currentPods) scaleUps++;
    if (desiredReplicasEffective < currentPods) scaleDowns++;

    points.push({
      t,
      pods: currentPods,
      queueJobs: currentQueue,
      latency,
      processedJobs: processed,
      desiredReplicasRaw,
      desiredReplicasEffective,
      scaleDirection: direction
    });

    // Update state for next tick
    podHistory.push(desiredReplicasEffective);
    currentPods = desiredReplicasEffective;
    currentQueue = nextQueue;
  }

  // Calculate Summary
  const maxLatency = Math.max(...points.map(p => p.latency));
  const maxQueue = Math.max(...points.map(p => p.queueJobs));
  const finalPoint = points[points.length - 1];

  return {
    points,
    summary: {
      maxLatency,
      maxQueueJobs: maxQueue,
      finalPods: finalPoint.pods,
      finalQueueJobs: finalPoint.queueJobs,
      totalScaleUps: scaleUps,
      totalScaleDowns: scaleDowns
    }
  };
};