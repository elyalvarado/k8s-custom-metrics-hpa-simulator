import { SimulatorConfig } from './types';

export const DEFAULT_CONFIG: SimulatorConfig = {
  metricType: 'QueueLatency',
  minPods: 1,
  maxPods: 20,
  startingPods: 2,
  initialQueueJobs: 0,
  initialMetricValue: 0,
  processingRatePerPod: 5,
  producingRateTotal: 25,
  
  simulationSeconds: 600,
  targetMetricValue: 2,
  toleranceFraction: 0.1,

  scaleUp: {
    stabilizationWindowSeconds: 0,
    selectPolicy: 'Max',
    policies: [
      { id: 'default-up-pods', type: 'Pods', value: 4, periodSeconds: 15 },
      { id: 'default-up-percent', type: 'Percent', value: 100, periodSeconds: 15 }
    ]
  },
  scaleDown: {
    stabilizationWindowSeconds: 300,
    selectPolicy: 'Max',
    policies: [
      { id: 'default-down-percent', type: 'Percent', value: 100, periodSeconds: 15 }
    ]
  }
};