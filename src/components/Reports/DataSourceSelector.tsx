import { Card } from "@/components/ui/card";
import { DataSourceType, reportDataSources } from "@/config/reportDataSources";
import { Database, Users, Phone, BarChart3 } from "lucide-react";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";

interface DataSourceSelectorProps {
  selected: DataSourceType | null;
  onSelect: (dataSource: DataSourceType) => void;
}

// Map data sources to their corresponding feature keys
const dataSourceFeatureMap: Record<DataSourceType, string> = {
  contacts: 'contacts',
  call_logs: 'calling',
  activities: 'contacts',
  pipeline_stages: 'pipeline_stages',
};

const iconMap: Record<DataSourceType, any> = {
  contacts: Users,
  call_logs: Phone,
  activities: BarChart3,
  pipeline_stages: BarChart3,
};

export default function DataSourceSelector({ selected, onSelect }: DataSourceSelectorProps) {
  const { canAccessFeature, loading } = useFeatureAccess();

  // Filter data sources based on org feature access
  const availableDataSources = Object.values(reportDataSources).filter((source) => {
    const featureKey = dataSourceFeatureMap[source.key];
    return canAccessFeature(featureKey);
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Select Data Source</h3>
        <div className="text-sm text-muted-foreground">Loading available data sources...</div>
      </div>
    );
  }

  if (availableDataSources.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Select Data Source</h3>
        <div className="text-sm text-muted-foreground">No data sources available. Contact your administrator.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Select Data Source</h3>
      <div className="grid grid-cols-2 gap-3">
        {availableDataSources.map((source) => {
          const Icon = iconMap[source.key];
          const isSelected = selected === source.key;
          
          return (
            <Card
              key={source.key}
              className={`p-4 cursor-pointer transition-all hover:shadow-md hover:bg-primary group ${
                isSelected ? 'ring-2 ring-primary bg-accent' : ''
              }`}
              onClick={() => onSelect(source.key)}
            >
              <div className="flex items-center gap-3">
                <Icon className={`h-5 w-5 transition-colors ${isSelected ? 'text-primary' : 'text-muted-foreground group-hover:text-primary-foreground'}`} />
                <div>
                  <p className="font-medium text-sm transition-colors group-hover:text-primary-foreground">{source.label}</p>
                  <p className="text-xs text-muted-foreground transition-colors group-hover:text-primary-foreground/80">{source.fields.length} fields</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
