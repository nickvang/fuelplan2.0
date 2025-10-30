import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Download, LogOut, Trash2, Users, Database, Activity } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import supplmeLogo from '@/assets/supplme-logo.png';

interface HydrationProfileData {
  id: string;
  created_at: string;
  profile_data: any;
  plan_data: any;
  consent_given: boolean;
  has_smartwatch_data: boolean;
  user_email: string | null;
  ip_address: string | unknown | null;
}

export default function Admin() {
  const [profiles, setProfiles] = useState<HydrationProfileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    withSmartwatch: 0,
    withoutSmartwatch: 0,
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAdminAndLoadData();
  }, []);

  const checkAdminAndLoadData = async () => {
    try {
      // Check if user is logged in
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/auth');
        return;
      }

      // Check if user is admin
      const { data: roles, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'admin')
        .single();

      if (roleError || !roles) {
        toast({
          title: "Access Denied",
          description: "You do not have admin privileges.",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      setIsAdmin(true);
      await loadProfiles();
    } catch (error) {
      console.error('Error checking admin status:', error);
      navigate('/auth');
    }
  };

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_all_hydration_profiles_admin');

      if (error) throw error;

      setProfiles(data || []);
      
      // Calculate stats
      const total = data?.length || 0;
      const withSmartwatch = data?.filter((p: any) => p.has_smartwatch_data).length || 0;
      
      setStats({
        total,
        withSmartwatch,
        withoutSmartwatch: total - withSmartwatch,
      });
    } catch (error: any) {
      toast({
        title: "Error Loading Data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const downloadAllDataCSV = () => {
    const csvRows = [
      ['Supplme Hydration Guide - All User Data Export', ''],
      ['Exported', new Date().toLocaleString()],
      ['Total Records', profiles.length],
      ['', ''],
      ['ID', 'Created At', 'Email', 'Consent', 'Smartwatch Data', 'Age', 'Sex', 'Weight', 'Height', 'Discipline', 'Session Duration', 'Pre-Water', 'During-Water/Hr', 'Post-Water'],
    ];

    profiles.forEach(profile => {
      const pd = profile.profile_data || {};
      const plan = profile.plan_data || {};
      
      csvRows.push([
        profile.id,
        new Date(profile.created_at).toLocaleString(),
        profile.user_email || 'Anonymous',
        profile.consent_given ? 'Yes' : 'No',
        profile.has_smartwatch_data ? 'Yes' : 'No',
        pd.age || 'N/A',
        pd.sex || 'N/A',
        pd.weight || 'N/A',
        pd.height || 'N/A',
        pd.disciplines?.[0] || 'N/A',
        pd.sessionDuration || 'N/A',
        plan.preActivity?.water || 'N/A',
        plan.duringActivity?.waterPerHour || 'N/A',
        plan.postActivity?.water || 'N/A',
      ]);
    });

    const csvContent = csvRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `supplme-all-data-${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Complete",
      description: `Downloaded ${profiles.length} records as CSV.`,
    });
  };

  const deleteProfile = async (id: string) => {
    if (!confirm('Are you sure you want to delete this profile? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('hydration_profiles')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Profile Deleted",
        description: "The profile has been permanently deleted.",
      });

      await loadProfiles();
    } catch (error: any) {
      toast({
        title: "Deletion Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <img src={supplmeLogo} alt="Supplme" className="h-16" />
            <div>
              <h1 className="text-3xl font-bold">Admin Dashboard</h1>
              <p className="text-muted-foreground">Manage hydration profile data</p>
            </div>
          </div>
          <Button onClick={handleLogout} variant="outline" className="gap-2">
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <Users className="w-10 h-10 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Profiles</p>
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <Activity className="w-10 h-10 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">With Smartwatch</p>
                <p className="text-3xl font-bold">{stats.withSmartwatch}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <Database className="w-10 h-10 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Manual Entry</p>
                <p className="text-3xl font-bold">{stats.withoutSmartwatch}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={downloadAllDataCSV} className="gap-2">
            <Download className="w-4 h-4" />
            Export All Data (CSV)
          </Button>
          <Button onClick={loadProfiles} variant="outline">
            Refresh Data
          </Button>
        </div>

        {/* Data Table */}
        <Card className="p-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">User Submissions</h2>
            
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Loading data...</p>
            ) : profiles.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No data collected yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Discipline</TableHead>
                      <TableHead>Age/Sex</TableHead>
                      <TableHead>Smartwatch</TableHead>
                      <TableHead>Consent</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profiles.map((profile) => (
                      <TableRow key={profile.id}>
                        <TableCell className="text-xs">
                          {new Date(profile.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-xs">
                          {profile.user_email || <span className="text-muted-foreground">Anonymous</span>}
                        </TableCell>
                        <TableCell>
                          {profile.profile_data?.disciplines?.[0] || 'N/A'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {profile.profile_data?.age || '?'} / {profile.profile_data?.sex || '?'}
                        </TableCell>
                        <TableCell>
                          {profile.has_smartwatch_data ? (
                            <Badge variant="default">Yes</Badge>
                          ) : (
                            <Badge variant="outline">No</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {profile.consent_given ? (
                            <Badge variant="default" className="bg-green-500">✓</Badge>
                          ) : (
                            <Badge variant="destructive">✗</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            onClick={() => deleteProfile(profile.id)}
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}