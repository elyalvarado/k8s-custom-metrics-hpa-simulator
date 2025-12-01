import React from 'react';
import { ScaleBehavior, ScalePolicy, ScalePolicyType, SelectPolicy } from '../types';
import { NumberInput, Select, Button } from './UI';
import { Trash2, Plus } from 'lucide-react';

interface Props {
  type: 'Scale Up' | 'Scale Down';
  value: ScaleBehavior;
  onChange: (val: ScaleBehavior) => void;
}

export const BehaviorForm: React.FC<Props> = ({ type, value, onChange }) => {
  const handlePolicyChange = (index: number, field: keyof ScalePolicy, val: any) => {
    const newPolicies = [...value.policies];
    newPolicies[index] = { ...newPolicies[index], [field]: val };
    onChange({ ...value, policies: newPolicies });
  };

  const addPolicy = () => {
    const newPolicy: ScalePolicy = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'Pods',
      value: 1,
      periodSeconds: 15
    };
    onChange({ ...value, policies: [...value.policies, newPolicy] });
  };

  const removePolicy = (index: number) => {
    const newPolicies = value.policies.filter((_, i) => i !== index);
    onChange({ ...value, policies: newPolicies });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <NumberInput
          label="Stabilization Window"
          suffix="sec"
          value={value.stabilizationWindowSeconds}
          onChange={(e) => onChange({ ...value, stabilizationWindowSeconds: parseInt(e.target.value) || 0 })}
        />
        <Select
          label="Select Policy"
          value={value.selectPolicy}
          onChange={(e) => onChange({ ...value, selectPolicy: e.target.value as SelectPolicy })}
          options={[
            { value: 'Max', label: 'Max (Aggressive)' },
            { value: 'Min', label: 'Min (Conservative)' },
            { value: 'Disabled', label: 'Disabled' },
          ]}
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-semibold text-slate-500 uppercase">Policies</label>
          <button
            onClick={addPolicy}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center"
          >
            <Plus size={14} className="mr-1" /> Add Policy
          </button>
        </div>
        
        {value.policies.length === 0 ? (
           <p className="text-sm text-slate-400 italic text-center py-2 bg-slate-50 rounded">No policies (Unbounded)</p>
        ) : (
          <div className="space-y-2">
            {value.policies.map((policy, idx) => (
              <div key={policy.id} className="flex gap-2 items-end bg-slate-50 p-2 rounded border border-slate-200">
                <div className="flex-1">
                  <Select
                    label="Type"
                    value={policy.type}
                    onChange={(e) => handlePolicyChange(idx, 'type', e.target.value as ScalePolicyType)}
                    options={[{ value: 'Pods', label: 'Pods' }, { value: 'Percent', label: 'Percent' }]}
                    style={{ marginBottom: 0 }}
                  />
                </div>
                <div className="flex-1">
                  <NumberInput
                    label="Value"
                    value={policy.value}
                    onChange={(e) => handlePolicyChange(idx, 'value', parseFloat(e.target.value))}
                    min={0}
                    style={{ marginBottom: 0 }}
                  />
                </div>
                <div className="flex-1">
                  <NumberInput
                    label="Period"
                    suffix="sec"
                    value={policy.periodSeconds}
                    onChange={(e) => handlePolicyChange(idx, 'periodSeconds', parseInt(e.target.value))}
                    min={1}
                    style={{ marginBottom: 0 }}
                  />
                </div>
                <button
                  onClick={() => removePolicy(idx)}
                  className="p-2 text-slate-400 hover:text-red-500"
                  title="Remove Policy"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};