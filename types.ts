export type ScalePolicyType = 'Pods' | 'Percent';
export type SelectPolicy = 'Max' | 'Min' | 'Disabled';

export interface ScalePolicy {
  id: string; // unique id for UI list handling
  type: ScalePolicyType;
  value: number;
  periodSeconds: number;
}

export interface ScaleBehavior {
  stabilizationWindowSeconds: number;
  selectPolicy: SelectPolicy;
  policies: ScalePolicy[];
}

export interface SimulatorConfig {
  // Workload
  minPods: number;
  maxPods: number;
  startingPods: number;
  initialQueueJobs: number;
  initialLatencySeconds: number;
  processingRatePerPod: number; // jobs/sec/pod
  producingRateTotal: number; // jobs/sec
  
  // Simulation
  simulationSeconds: number;
  targetLatencySeconds: number;
  toleranceFraction: number;

  // Behavior
  scaleUp: ScaleBehavior;
  scaleDown: ScaleBehavior;
}

export interface SimulationPoint {
  t: number;
  pods: number;
  queueJobs: number;
  latency: number;
  processedJobs: number;
  desiredReplicasRaw: number;
  desiredReplicasEffective: number;
  scaleDirection: 'up' | 'down' | 'none';
}

export interface SimulationResult {
  points: SimulationPoint[];
  summary: {
    maxLatency: number;
    maxQueueJobs: number;
    finalPods: number;
    finalQueueJobs: number;
    totalScaleUps: number;
    totalScaleDowns: number;
  };
}