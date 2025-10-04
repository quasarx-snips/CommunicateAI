import MetricBar from '../MetricBar';

export default function MetricBarExample() {
  return (
    <div className="p-8 space-y-6 max-w-xl bg-white">
      <MetricBar label="Confidence" value={91} color="green" />
      <MetricBar label="Openness" value={100} color="green" />
      <MetricBar label="Engagement" value={100} color="green" />
      <MetricBar label="Stress Level" value={80} color="orange" />
    </div>
  );
}
