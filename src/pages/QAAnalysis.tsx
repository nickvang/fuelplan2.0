import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { analyzeAlgorithmIssues, summarizeIssues } from '@/utils/qaAnalysis';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

export default function QAAnalysis() {
  const issues = analyzeAlgorithmIssues();
  const summary = summarizeIssues(issues);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'HIGH': return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      case 'MEDIUM': return <Info className="h-5 w-5 text-yellow-600" />;
      default: return null;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'destructive';
      case 'HIGH': return 'secondary';
      case 'MEDIUM': return 'default';
      default: return 'outline';
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-[1200px]">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">🔍 Algorithm Root Cause Analysis</h1>
        <p className="text-muted-foreground">
          Manual deep-dive into the hydration calculator logic without running full tests
        </p>
      </div>

      <Card className="p-6 mb-6 bg-slate-50 dark:bg-slate-900">
        <pre className="text-sm whitespace-pre-wrap font-mono">{summary}</pre>
      </Card>

      <div className="space-y-6">
        {issues.map((issue, idx) => (
          <Card key={idx} className="p-6 border-l-4" style={{
            borderLeftColor: issue.severity === 'CRITICAL' ? '#dc2626' : 
                           issue.severity === 'HIGH' ? '#ea580c' : '#ca8a04'
          }}>
            <div className="flex items-start gap-4">
              <div className="mt-1">
                {getSeverityIcon(issue.severity)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-xl font-bold">{issue.category}</h2>
                  <Badge variant={getSeverityColor(issue.severity) as any}>
                    {issue.severity}
                  </Badge>
                </div>

                <div className="mb-4">
                  <h3 className="font-semibold text-sm mb-2 text-muted-foreground">ROOT CAUSE:</h3>
                  <div className="bg-muted/50 p-4 rounded-md">
                    <pre className="text-sm whitespace-pre-wrap">{issue.rootCause}</pre>
                  </div>
                </div>

                <div className="mb-4">
                  <h3 className="font-semibold text-sm mb-2 text-muted-foreground">AFFECTED SCENARIOS:</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {issue.affectedScenarios.map((scenario, i) => (
                      <li key={i}>{scenario}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-sm mb-2 text-muted-foreground">EXAMPLE:</h3>
                  <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-md border border-red-200 dark:border-red-900">
                    <pre className="text-xs font-mono whitespace-pre-wrap">
                      {JSON.stringify(issue.example, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-8 p-6 bg-blue-50 dark:bg-blue-950/20">
        <h2 className="text-xl font-bold mb-4">📋 Next Steps</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>Review each root cause with domain expert or research papers</li>
          <li>Prioritize fixes: CRITICAL → HIGH → MEDIUM</li>
          <li>Update algorithm logic with corrected formulas</li>
          <li>Re-run QA test suite to verify fixes</li>
          <li>Document rationale for each change with citations</li>
        </ol>
      </Card>
    </div>
  );
}
