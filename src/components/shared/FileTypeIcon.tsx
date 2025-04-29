
import { FC } from 'react';
import { FileText, Image, File, Music, Video, Archive, Database, Code } from 'lucide-react';

interface FileTypeIconProps {
  contentType: string;
  className?: string;
}

export const FileTypeIcon: FC<FileTypeIconProps> = ({ contentType, className = "h-6 w-6" }) => {
  // Default icon
  let Icon = File;
  let colorClass = "text-blue-500";
  
  if (!contentType) {
    return <File className={`${className} text-blue-500`} />;
  }
  
  // Map content types to appropriate icons and colors
  if (contentType.startsWith('image/')) {
    Icon = Image;
    colorClass = "text-green-500";
  } else if (contentType === 'application/pdf') {
    Icon = FileText;
    colorClass = "text-amber-500";
  } else if (contentType.includes('document') || contentType.includes('word') || contentType === 'application/rtf') {
    Icon = FileText;
    colorClass = "text-sky-500";
  } else if (contentType.includes('spreadsheet') || contentType.includes('excel')) {
    Icon = Database;
    colorClass = "text-emerald-500";
  } else if (contentType.includes('presentation') || contentType.includes('powerpoint')) {
    Icon = FileText;
    colorClass = "text-orange-500";
  } else if (contentType.startsWith('audio/')) {
    Icon = Music;
    colorClass = "text-purple-500";
  } else if (contentType.startsWith('video/')) {
    Icon = Video;
    colorClass = "text-red-500";
  } else if (contentType.includes('zip') || contentType.includes('compressed') || contentType.includes('archive')) {
    Icon = Archive;
    colorClass = "text-yellow-500";
  } else if (contentType.includes('json') || contentType.includes('javascript') || contentType.includes('html') || contentType.includes('css')) {
    Icon = Code;
    colorClass = "text-indigo-500";
  }
  
  return <Icon className={`${className} ${colorClass}`} />;
};
