import { SimulatorConfig } from './types';
import { v4 as uuidv4 } from 'uuid'; // We'll implement a simple ID generator since uuid lib might not be avail

const generateId = () => Math.random().toString(36).substr(2, 9);

export const DEFAULT_CONFIG: SimulatorConfig = {
  minPods: 1,
  maxPods: 20,
  startingPods: 2,
  initialQueueJobs: 0,
  initialLatencySeconds: 0,
  processingRatePerPod: 5,
  producingRateTotal: 25,
  
  simulationSeconds: 600,
  targetLatencySeconds: 2,
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