import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase, DEFAULT_SITE_ID } from '@/lib/supabase';
import { AlertTriangle, Users, Truck, Activity } from 'lucide-react';
import { Alert as AlertType } from '@/types/database';
import { formatDistanceToNow } from 'date-fns';

async function getDashboardData() {
  // Fetch site info
  const { data: site } = await supabase
    .from('sites')
    .select('*')
    .eq('id', DEFAULT_SITE_ID)
    .single();

  // Fetch stats
  const { count: peopleCount } = await supabase
    .from('people')
    .select('*', { count: 'exact', head: true })
    .eq('site_id', DEFAULT_SITE_ID);

  const { count: activePeopleCount } = await supabase
    .from('people')
    .select('*', { count: 'exact', head: true })
    .eq('site_id', DEFAULT_SITE_ID)
    .eq('status', 'Working');

  const { count: machinesCount } = await supabase
    .from('machines')
    .select('*', { count: 'exact', head: true })
    .eq('site_id', DEFAULT_SITE_ID);

  const { count: activeMachinesCount } = await supabase
    .from('machines')
    .select('*', { count: 'exact', head: true })
    .eq('site_id', DEFAULT_SITE_ID)
    .eq('status', 'Active');

  const { count: todayAlertsCount } = await supabase
    .from('alerts')
    .select('*', { count: 'exact', head: true })
    .eq('site_id', DEFAULT_SITE_ID)
    .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString());

  const { count: unacknowledgedAlertsCount } = await supabase
    .from('alerts')
    .select('*', { count: 'exact', head: true })
    .eq('site_id', DEFAULT_SITE_ID)
    .eq('acknowledged', false);

  // Fetch recent alerts
  const { data: recentAlerts } = await supabase
    .from('alerts')
    .select('*')
    .eq('site_id', DEFAULT_SITE_ID)
    .order('created_at', { ascending: false })
    .limit(5);

  return {
    site,
    stats: {
      peopleCount: peopleCount || 0,
      activePeopleCount: activePeopleCount || 0,
      machinesCount: machinesCount || 0,
      activeMachinesCount: activeMachinesCount || 0,
      todayAlertsCount: todayAlertsCount || 0,
      unacknowledgedAlertsCount: unacknowledgedAlertsCount || 0,
    },
    recentAlerts: (recentAlerts || []) as AlertType[],
  };
}

function getSeverityColor(severity: string) {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'high':
      return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    default:
      return 'bg-blue-100 text-blue-800 border-blue-300';
  }
}

function getAlertTypeLabel(type: string) {
  switch (type) {
    case 'ProximityWarning':
      return '⚠️ Proximity Warning';
    case 'PersonDown':
      return '🚨 Person Down';
    case 'HeadcountMismatch':
      return '👥 Headcount Mismatch';
    default:
      return type;
  }
}

export default async function Dashboard() {
  const { site, stats, recentAlerts } = await getDashboardData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{site?.name || 'Dashboard'}</h1>
        <p className="text-gray-500 mt-1">{site?.address || 'No address'}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">People On Site</CardTitle>
            <Users className="w-4 h-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activePeopleCount}</div>
            <p className="text-xs text-gray-500 mt-1">
              {stats.peopleCount} total registered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Machines</CardTitle>
            <Truck className="w-4 h-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeMachinesCount}</div>
            <p className="text-xs text-gray-500 mt-1">
              {stats.machinesCount} total machines
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Alerts Today</CardTitle>
            <Activity className="w-4 h-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayAlertsCount}</div>
            <p className="text-xs text-gray-500 mt-1">
              Since midnight
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Unacknowledged</CardTitle>
            <AlertTriangle className="w-4 h-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats.unacknowledgedAlertsCount}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Require attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {recentAlerts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No alerts yet</p>
          ) : (
            <div className="space-y-3">
              {recentAlerts.map((alert) => (
                <Alert
                  key={alert.id}
                  className={getSeverityColor(alert.severity)}
                >
                  <AlertDescription className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{getAlertTypeLabel(alert.type)}</span>
                      {alert.duration_s && (
                        <span className="text-sm ml-2">
                          ({alert.duration_s.toFixed(1)}s duration)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{alert.severity}</Badge>
                      <span className="text-xs text-gray-600">
                        {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}