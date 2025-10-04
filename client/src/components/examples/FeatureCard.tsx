import FeatureCard from '../FeatureCard';
import { Smile, User, Hand, TrendingUp } from 'lucide-react';

export default function FeatureCardExample() {
  return (
    <div className="p-8 space-y-4 max-w-md">
      <FeatureCard icon={Smile} title="Emotion Detection" color="green" />
      <FeatureCard icon={User} title="Posture Analysis" color="blue" />
      <FeatureCard icon={Hand} title="Gesture Recognition" color="orange" />
      <FeatureCard icon={TrendingUp} title="Actionable Insights" color="purple" />
    </div>
  );
}
