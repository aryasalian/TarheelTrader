import { api } from "@/utils/trpc/api";
import { usePortfolioValue } from "@/hooks/usePortfolioValue";

export default function PortfolioPage() {
  const { data: positions = [], isLoading } = api.position.getPositions.useQuery();

  const totalValue = usePortfolioValue(positions);

  if (isLoading) return <div>Loading portfolio...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">My Portfolio</h1>
      
      <div className="mt-4 text-lg">
        Current Value: <span className="font-bold">${totalValue.toFixed(2)}</span>
      </div>
    </div>
  );
}