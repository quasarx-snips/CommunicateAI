import InsightSection from '../InsightSection';
import { CheckCircle2, AlertTriangle, Lightbulb } from 'lucide-react';

export default function InsightSectionExample() {
  return (
    <div className="p-8 space-y-6 max-w-2xl">
      <InsightSection
        icon={CheckCircle2}
        title="Strengths"
        variant="success"
        items={[
          "Good posture and confident stance",
          "Good engagement and forward presence"
        ]}
      />
      <InsightSection
        icon={AlertTriangle}
        title="Areas for Improvement"
        variant="warning"
        items={[
          "Try to keep arms uncrossed and open"
        ]}
      />
      <InsightSection
        icon={Lightbulb}
        title="Recommendations"
        variant="info"
        items={[
          "Practice relaxation techniques before important conversations",
          "Practice maintaining a slight smile for approachability"
        ]}
      />
    </div>
  );
}
