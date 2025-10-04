import DetectionResult from '../DetectionResult';
import { User, Hand, Activity } from 'lucide-react';

export default function DetectionResultExample() {
  return (
    <div className="p-8 flex gap-8 justify-center bg-gray-50">
      <DetectionResult icon={User} label="Pose" value={1} color="green" />
      <DetectionResult icon={Activity} label="Gesture" value={1} color="blue" />
      <DetectionResult icon={Hand} label="Hands" value={0} color="orange" />
    </div>
  );
}
