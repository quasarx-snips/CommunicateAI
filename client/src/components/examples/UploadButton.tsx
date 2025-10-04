import UploadButton from '../UploadButton';
import { Camera, Video, Mic } from 'lucide-react';

export default function UploadButtonExample() {
  return (
    <div className="p-8 space-y-4 max-w-md">
      <UploadButton 
        icon={Camera} 
        label="Take Photo" 
        onClick={() => console.log('Take photo clicked')}
      />
      <UploadButton 
        icon={Video} 
        label="Upload Video" 
        onClick={() => console.log('Upload video clicked')}
      />
      <UploadButton 
        icon={Mic} 
        label="Record Audio" 
        onClick={() => console.log('Record audio clicked')}
      />
    </div>
  );
}
