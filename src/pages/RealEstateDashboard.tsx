
import { LayoutDashboard, Home, DollarSign, Users, Settings, Bell, Search, TrendingUp, TrendingDown } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { StatCard } from "@/components/dashboard/StatCard";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const chartData = [
  { name: 'Apartment', inquiries: 400, views: 2400 },
  { name: 'House', inquiries: 300, views: 1398 },
  { name: 'Office', inquiries: 200, views: 9800 },
  { name: 'Villa', inquiries: 278, views: 3908 },
  { name: 'Studio', inquiries: 189, views: 4800 },
];

const recentActivity = [
  { property: 'Sunrise Apartments', status: 'Sold', price: '$450,000', date: '2023-10-24' },
  { property: 'Green Valley House', status: 'Pending', price: '$820,000', date: '2023-10-23' },
  { property: 'Ocean View Villa', status: 'Active', price: '$1,200,000', date: '2023-10-22' },
  { property: 'Downtown Office', status: 'Sold', price: '$2,400,000', date: '2023-10-21' },
  { property: 'Studio Loft', status: 'Active', price: '$280,000', date: '2023-10-20' },
];

export default function RealEstateDashboard() {
  return (
    <AppLayout>
      <div className="p-6 space-y-8 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome back, Admin!</h1>
            <p className="text-muted-foreground">Here's what's happening with your properties today.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search properties..."
                className="pl-8 bg-background"
              />
            </div>
            <Button variant="outline" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
            </Button>
            <Avatar>
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback>AD</AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Active Listings"
            value="124"
            icon={Home}
            customChange={
              <div className="flex items-center gap-1 mt-1 text-success text-xs font-medium">
                <TrendingUp className="h-3 w-3" />
                <span>+12% from last month</span>
              </div>
            }
          />
          <StatCard
            title="Total Sales"
            value="$2.4M"
            icon={DollarSign}
            iconColor="success"
            customChange={
              <div className="flex items-center gap-1 mt-1 text-success text-xs font-medium">
                <TrendingUp className="h-3 w-3" />
                <span>+8% from last month</span>
              </div>
            }
          />
          <StatCard
            title="New Leads"
            value="48"
            icon={Users}
            iconColor="warning"
            customChange={
              <div className="flex items-center gap-1 mt-1 text-success text-xs font-medium">
                <TrendingUp className="h-3 w-3" />
                <span>+15% from last month</span>
              </div>
            }
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Activity */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Recent Activity</h2>
              <Button variant="ghost" size="sm">View all</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentActivity.map((activity, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{activity.property}</TableCell>
                    <TableCell>
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        activity.status === 'Sold' ? "bg-success/10 text-success" : 
                        activity.status === 'Pending' ? "bg-warning/10 text-warning" : 
                        "bg-primary/10 text-primary"
                      )}>
                        {activity.status}
                      </span>
                    </TableCell>
                    <TableCell>{activity.price}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{activity.date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Property Statistics */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Property Statistics</h2>
              <select className="bg-background border border-input rounded-md px-2 py-1 text-xs">
                <option>Last 30 days</option>
                <option>Last 6 months</option>
                <option>Year to date</option>
              </select>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                  />
                  <Tooltip 
                    cursor={{ fill: 'hsl(var(--muted)/0.4)' }}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    align="right" 
                    iconType="circle"
                    wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }}
                  />
                  <Bar 
                    dataKey="views" 
                    name="Views" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]} 
                    barSize={20} 
                  />
                  <Bar 
                    dataKey="inquiries" 
                    name="Inquiries" 
                    fill="hsl(var(--warning))" 
                    radius={[4, 4, 0, 0]} 
                    barSize={20} 
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

import { cn } from "@/lib/utils";
