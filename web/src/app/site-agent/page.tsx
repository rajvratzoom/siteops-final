'use client';

import { useState, useEffect } from 'react';
import { Activity, AlertTriangle, Users, Truck, FileText, RefreshCw, Zap, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

interface SiteData {
  people: any[];
  alerts: any[];
  tickets: any[];
  machines: any[];
}

interface AgentResponse {
  analysis?: string;
  data: SiteData;
  timestamp: string;
}

export default function SiteAgentPage() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [siteData, setSiteData] = useState<SiteData | null>(null);
  const [analysis, setAnalysis] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Fetch site data
  const fetchSiteData = async (analyze: boolean = false) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/site-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: analyze ? 'analyze' : 'fetch' }),
      });

      const result: AgentResponse = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      setSiteData(result.data);
      setLastUpdate(new Date(result.timestamp).toLocaleTimeString());
      
      if (result.analysis) {
        setAnalysis(result.analysis);
      }
    } catch (error: any) {
      console.error('Failed to fetch site data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh when monitoring is enabled
  useEffect(() => {
    if (isMonitoring && autoRefresh) {
      const interval = setInterval(() => {
        fetchSiteData(false);
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
  }, [isMonitoring, autoRefresh]);

  // Initial load
  useEffect(() => {
    fetchSiteData(false);
  }, []);

  // Calculate analytics
  const analytics = siteData ? {
    totalPeople: siteData.people.length,
    activePeople: siteData.people.filter(p => p.status === 'Working').length,
    totalAlerts: siteData.alerts.length,
    criticalAlerts: siteData.alerts.filter(a => a.type === 'PersonDown').length,
    proximityWarnings: siteData.alerts.filter(a => a.type === 'ProximityWarning').length,
    totalTickets: siteData.tickets.length,
    openTickets: siteData.tickets.filter(t => t.status === 'Open' || t.status === 'In Progress').length,
    highPriorityTickets: siteData.tickets.filter(t => t.priority === 'High' || t.priority === 'Critical').length,
    activeMachines: siteData.machines.filter(m => m.status === 'Active').length,
    totalMachines: siteData.machines.length,
  } : null;

  const handleRunAnalysis = () => {
    setIsMonitoring(true);
    fetchSiteData(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Activity className="h-8 w-8 text-purple-600" />
            <h1 className="text-3xl font-bold">Site Agent</h1>
            {isMonitoring && (
              <Badge className="bg-green-500">
                <Zap className="h-3 w-3 mr-1" />
                Monitoring Active
              </Badge>
            )}
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            AI-powered site monitoring and analysis
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Auto-refresh</span>
            <Switch
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
              disabled={!isMonitoring}
            />
          </div>
          <Button
            onClick={() => fetchSiteData(false)}
            variant="outline"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={handleRunAnalysis}
            disabled={isLoading}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Zap className="h-4 w-4 mr-2" />
            Run Analysis
          </Button>
        </div>
      </div>

      {lastUpdate && (
        <p className="text-sm text-gray-500">Last updated: {lastUpdate}</p>
      )}

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Workforce */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-8 w-8 text-blue-600" />
              <Badge variant="outline">{analytics.activePeople} Active</Badge>
            </div>
            <h3 className="text-2xl font-bold">{analytics.totalPeople}</h3>
            <p className="text-sm text-gray-600">Total Workers</p>
          </Card>

          {/* Safety Alerts */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <Badge variant="destructive">{analytics.criticalAlerts} Critical</Badge>
            </div>
            <h3 className="text-2xl font-bold">{analytics.totalAlerts}</h3>
            <p className="text-sm text-gray-600">Safety Alerts</p>
          </Card>

          {/* Tickets */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <FileText className="h-8 w-8 text-orange-600" />
              <Badge className="bg-orange-500">{analytics.highPriorityTickets} High Priority</Badge>
            </div>
            <h3 className="text-2xl font-bold">{analytics.openTickets}</h3>
            <p className="text-sm text-gray-600">Open Tickets</p>
          </Card>

          {/* Equipment */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Truck className="h-8 w-8 text-green-600" />
              <Badge className="bg-green-500">{analytics.activeMachines} Active</Badge>
            </div>
            <h3 className="text-2xl font-bold">{analytics.totalMachines}</h3>
            <p className="text-sm text-gray-600">Total Equipment</p>
          </Card>
        </div>
      )}

      {/* AI Analysis */}
      {analysis && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Zap className="h-5 w-5 text-purple-600" />
              AI Analysis & Recommendations
            </h2>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Create Ticket from Analysis
            </Button>
          </div>
          <div className="prose dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {analysis}
            </pre>
          </div>
        </Card>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Alerts */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Recent Alerts
          </h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {siteData?.alerts.slice(0, 10).map((alert, index) => (
              <div
                key={index}
                className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div>
                  <p className="font-medium">{alert.type}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {new Date(alert.created_at).toLocaleString()}
                  </p>
                </div>
                <Badge variant={alert.type === 'PersonDown' ? 'destructive' : 'default'}>
                  {alert.type === 'PersonDown' ? 'Critical' : 'Warning'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Active Tickets */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-orange-600" />
            Active Tickets
          </h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {siteData?.tickets
              .filter(t => t.status === 'Open' || t.status === 'In Progress')
              .slice(0, 10)
              .map((ticket, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium">{ticket.title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {ticket.status}
                    </p>
                  </div>
                  <Badge
                    variant={
                      ticket.priority === 'Critical' || ticket.priority === 'High'
                        ? 'destructive'
                        : 'default'
                    }
                  >
                    {ticket.priority || 'Normal'}
                  </Badge>
                </div>
              ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
