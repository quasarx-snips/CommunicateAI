import ScoreDisplay from '../ScoreDisplay';

export default function ScoreDisplayExample() {
  return (
    <div className="p-8 bg-gray-50">
      <ScoreDisplay 
        score="Good" 
        description="Good body language with room for minor improvements." 
        rating="good"
      />
    </div>
  );
}
