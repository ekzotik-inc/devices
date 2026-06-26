/** Индикатор прогресса обработки. */

interface Props {
  stage: string;
  percent: number;
}

export default function ProgressBar({ stage, percent }: Props) {
  return (
    <div className="progress-wrap">
      <div className="progress-label">
        <span>{stage}</span>
        <span>{Math.round(percent)}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
