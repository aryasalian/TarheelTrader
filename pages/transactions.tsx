import { Subject } from "@/server/models/auth";
import { createSupabaseServerClient } from "@/utils/supabase/clients/server-props";
import { GetServerSidePropsContext } from "next";
import { api } from "@/utils/trpc/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { Navigation } from "@/components/navigation";

type TransactionsPageProps = { user: Subject };

export default function TransactionsPage({ user }: TransactionsPageProps) {
  const { data: transactions, refetch } = api.transaction.getTransactions.useQuery();
  const { data: stats } = api.transaction.getTransactionStats.useQuery();
  const createTransaction = api.transaction.createTransaction.useMutation();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [action, setAction] = useState<"buy" | "sell">("buy");

  const handleNewTrade = async () => {
    if (symbol.trim() && quantity && price) {
      try {
        await createTransaction.mutateAsync({
          symbol: symbol.toUpperCase(),
          quantity: parseFloat(quantity),
          price: parseFloat(price),
          action: action,
        });
        setSymbol("");
        setQuantity("");
        setPrice("");
        setAction("buy");
        setIsDialogOpen(false);
        refetch();
      } catch (error) {
        window.alert("Failed to create transaction");
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="mx-auto max-w-7xl p-8">

        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold">Transaction Log</h1>
              <p className="mt-2 text-muted-foreground">Track all your paper trading activity</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Trade
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record New Trade</DialogTitle>
                  <DialogDescription>Add a buy or sell transaction to your log</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="action">Action</Label>
                    <Select value={action} onValueChange={(value) => setAction(value as "buy" | "sell")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="buy">Buy</SelectItem>
                        <SelectItem value="sell">Sell</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="symbol">Ticker</Label>
                    <Input
                      id="symbol"
                      placeholder="AAPL"
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      placeholder="10"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="price">Price</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      placeholder="150.00"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                  </div>
                </div>
                <Button onClick={handleNewTrade} className="w-full">
                  Record Trade
                </Button>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="mb-6 grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Total Transactions</CardDescription>
              <CardTitle className="text-3xl">{stats?.totalTransactions || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Total Bought</CardDescription>
              <CardTitle className="text-3xl text-green-600">
                ${stats?.totalBought.toFixed(2) || "0.00"}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Total Sold</CardDescription>
              <CardTitle className="text-3xl text-red-600">
                ${stats?.totalSold.toFixed(2) || "0.00"}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>All your paper trades in chronological order</CardDescription>
          </CardHeader>
          <CardContent>
            {!transactions || transactions.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">No transactions yet.</p>
                <p className="mt-2 text-sm text-muted-foreground">Click "New Trade" to record your first transaction.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Ticker</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((txn) => {
                    const amount = parseFloat(txn.quantity) * parseFloat(txn.price);
                    const date = new Date(txn.executedAt);
                    const year = date.getFullYear();
                    
                    return (
                      <TableRow key={txn.id}>
                        <TableCell>{year}</TableCell>
                        <TableCell className="font-medium">{txn.symbol}</TableCell>
                        <TableCell>
                          <span className={txn.action === "buy" ? "text-green-600" : "text-red-600"}>
                            {txn.action.charAt(0).toUpperCase() + txn.action.slice(1)}
                          </span>
                        </TableCell>
                        <TableCell>${amount.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const supabase = createSupabaseServerClient(context);
  const { data: userData, error: userError } = await supabase.auth.getClaims();

  if (userError || !userData) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }

  return {
    props: {
      user: { id: userData.claims.sub },
    },
  };
}
