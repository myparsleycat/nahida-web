import { useEffect, useState } from "react";

interface Props {
  riskCount: number;
  grayCount: number;
  total: number;
}

export const CircularProgress = (props: Props) => {
  const { riskCount, grayCount, total } = props;
  const [percentage, setPercentage] = useState(0);
  const [grayPercentage, setGrayPercentage] = useState(0);
  const [strokeWidth, setStrokeWidth] = useState(0);
  const [radius, setRadius] = useState(0);
  const [circumference, setCircumference] = useState(0);
  const [strokeDashoffset, setStrokeDashoffset] = useState(0);
  const [isRiskDetected, setIsRiskDetected] = useState(false);

  useEffect(() => {
    const newStrokeWidth = 8;
    const newRadius = 88;
    const newCircumference = 2 * Math.PI * newRadius;
    const newPercentage = (riskCount / total) * 100;
    const newGrayPercentage = (grayCount / total) * 100;

    setStrokeWidth(newStrokeWidth);
    setRadius(newRadius);
    setPercentage(newPercentage);
    setGrayPercentage(newGrayPercentage);
    setCircumference(newCircumference);
    setStrokeDashoffset(newCircumference - (newPercentage / 100) * newCircumference);
    setIsRiskDetected(riskCount > 0);
  }, [riskCount, grayCount, total]);

  return (
    <svg className="h-48 w-48">
      <circle
        className="text-green-500"
        strokeWidth={strokeWidth}
        stroke="currentColor"
        fill="transparent"
        r={radius}
        cx="96"
        cy="96"
      />
      <circle
        className={isRiskDetected ? "text-red-500" : "text-green-500"}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        stroke="currentColor"
        fill="transparent"
        r={radius}
        cx="96"
        cy="96"
        transform="rotate(-90 96 96)"
      />
      <text
        x="50%"
        y="45%"
        dy=".3em"
        textAnchor="middle"
        className="fill-black text-3xl font-bold dark:fill-white"
      >
        {riskCount}
      </text>
      <text x="50%" y="60%" textAnchor="middle" className="fill-black text-lg dark:fill-white">
        / {total}
      </text>
    </svg>
  );
};
