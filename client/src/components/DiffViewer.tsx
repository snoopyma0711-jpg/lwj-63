import { DiffSegment } from '../types';

interface DiffViewerProps {
  diff: DiffSegment[];
  side: 'left' | 'right';
}

export default function DiffViewer({ diff, side }: DiffViewerProps) {
  const renderSegment = (segment: DiffSegment, index: number) => {
    if (segment.added && side === 'left') return null;
    if (segment.removed && side === 'right') return null;

    let className = '';
    if (segment.added && side === 'right') {
      className = 'diff-added';
    } else if (segment.removed && side === 'left') {
      className = 'diff-removed';
    }

    return (
      <span key={index} className={className} style={{ whiteSpace: 'pre-wrap' }}>
        {segment.value}
      </span>
    );
  };

  return <div className="text-gray-800 leading-relaxed">{diff.map(renderSegment)}</div>;
}
