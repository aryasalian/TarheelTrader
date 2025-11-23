"use client";

import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
} from "chart.js";

import "chartjs-adapter-date-fns";
import { Line } from "react-chartjs-2";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  TimeScale,   // REQUIRED for "time" scale
  Title,
  Tooltip,
  Legend,
  Filler,
);

interface PortfolioDataPoint {
  date: string;
  value: number;
}

interface PortfolioChartProps {
  data: PortfolioDataPoint[];
  interval: "hourly" | "daily" | "weekly" | "monthly";
}

export function PortfolioChart({ data, interval }: PortfolioChartProps) {
  const chartData = useMemo(() => {
    const labels = data.map((point) => new Date(point.date));
    const values = data.map((point) => point.value);

    return {
      labels,
      datasets: [
        {
          label: "Portfolio Value",
          data: values,
          borderColor: "rgb(34, 197, 94)",
          backgroundColor: "rgba(34, 197, 94, 0.1)",
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: "rgb(34, 197, 94)",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
        },
      ],
    };
  }, [data]);

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: "index",
        intersect: false,
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            return `Portfolio Value: $${value?.toFixed(2) ?? "0.00"}`;
          },
        },
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        titleColor: "#fff",
        bodyColor: "#fff",
        borderColor: "rgb(34, 197, 94)",
        borderWidth: 1,
        padding: 12,
        displayColors: false,
      },
    },
    scales: {
      x: {
        type: "time",
        time: {
          unit:
            interval === "hourly"
              ? "hour"
              : interval === "daily"
              ? "day"
              : interval === "weekly"
              ? "week"
              : "month",

          displayFormats: {
            hour: "MMM d, h a",
            day: "MMM d",
            week: "MMM d",
            month: "MMM yyyy",
          },

          tooltipFormat:
            interval === "hourly"
              ? "MMM d, h:mm a"
              : "MMM d, yyyy"
        },
        grid: {
          display: false,
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          autoSkip: true,
          maxTicksLimit: interval === "hourly" ? 12 : 7,
        },
      },
      y: {
        beginAtZero: false,
        grid: {
          color: "rgba(0, 0, 0, 0.05)",
        },
        ticks: {
          callback: (value) => `$${value}`,
        },
      },
    },
    interaction: {
      mode: "nearest",
      axis: "x",
      intersect: false,
    },
  };

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed">
        <p className="text-muted-foreground">No portfolio history available yet</p>
      </div>
    );
  }

  return (
    <div className="h-64">
      <Line
        key={`${interval}-${data.length}`}
        data={chartData}
        options={options}
      />
    </div>
  );
}
