export type DataSourceType = 'contacts' | 'call_logs' | 'activities' | 'pipeline_stages';

export type FieldType = 'text' | 'number' | 'date' | 'enum' | 'boolean';

export interface DataSourceField {
  key: string;
  label: string;
  type: FieldType;
  aggregations?: ('count' | 'sum' | 'avg' | 'min' | 'max')[];
}

export interface DataSource {
  key: DataSourceType;
  label: string;
  table: string;
  fields: DataSourceField[];
  filters: string[];
}

export const reportDataSources: Record<DataSourceType, DataSource> = {
  contacts: {
    key: 'contacts',
    label: 'Contacts',
    table: 'contacts',
    fields: [
      { key: 'first_name', label: 'First Name', type: 'text' },
      { key: 'last_name', label: 'Last Name', type: 'text' },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'company', label: 'Company', type: 'text' },
      { key: 'job_title', label: 'Job Title', type: 'text' },
      { key: 'status', label: 'Status', type: 'enum' },
      { key: 'source', label: 'Source', type: 'text' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'state', label: 'State', type: 'text' },
      { key: 'country', label: 'Country', type: 'text' },
      { key: 'created_at', label: 'Created Date', type: 'date' },
      { key: 'id', label: 'Count', type: 'number', aggregations: ['count'] },
    ],
    filters: ['status', 'assigned_to', 'pipeline_stage_id', 'created_at', 'source'],
  },
  call_logs: {
    key: 'call_logs',
    label: 'Call Logs',
    table: 'call_logs',
    fields: [
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'direction', label: 'Direction', type: 'enum' },
      { key: 'call_type', label: 'Call Type', type: 'text' },
      { key: 'call_duration', label: 'Call Duration (s)', type: 'number', aggregations: ['sum', 'avg', 'max'] },
      { key: 'conversation_duration', label: 'Conversation Duration (s)', type: 'number', aggregations: ['sum', 'avg', 'max'] },
      { key: 'ring_duration', label: 'Ring Duration (s)', type: 'number', aggregations: ['sum', 'avg'] },
      { key: 'started_at', label: 'Call Date', type: 'date' },
      { key: 'to_number', label: 'To Number', type: 'text' },
      { key: 'from_number', label: 'From Number', type: 'text' },
      { key: 'id', label: 'Count', type: 'number', aggregations: ['count'] },
    ],
    filters: ['status', 'direction', 'agent_id', 'started_at', 'disposition_id'],
  },
  activities: {
    key: 'activities',
    label: 'Activities',
    table: 'contact_activities',
    fields: [
      { key: 'activity_type', label: 'Activity Type', type: 'enum' },
      { key: 'subject', label: 'Subject', type: 'text' },
      { key: 'description', label: 'Description', type: 'text' },
      { key: 'created_at', label: 'Created Date', type: 'date' },
      { key: 'completed_at', label: 'Completed Date', type: 'date' },
      { key: 'scheduled_at', label: 'Scheduled Date', type: 'date' },
      { key: 'call_duration', label: 'Call Duration (s)', type: 'number', aggregations: ['sum', 'avg', 'max'] },
      { key: 'id', label: 'Count', type: 'number', aggregations: ['count'] },
    ],
    filters: ['activity_type', 'created_by', 'contact_id', 'created_at'],
  },
  pipeline_stages: {
    key: 'pipeline_stages',
    label: 'Pipeline Stages',
    table: 'pipeline_stages',
    fields: [
      { key: 'name', label: 'Stage Name', type: 'text' },
      { key: 'description', label: 'Description', type: 'text' },
      { key: 'probability', label: 'Probability (%)', type: 'number', aggregations: ['avg'] },
      { key: 'stage_order', label: 'Order', type: 'number' },
      { key: 'color', label: 'Color', type: 'text' },
      { key: 'id', label: 'Count', type: 'number', aggregations: ['count'] },
    ],
    filters: ['org_id'],
  },
};

export const getDataSource = (key: DataSourceType): DataSource => {
  return reportDataSources[key];
};

export const getFieldsByType = (dataSource: DataSource, type: FieldType): DataSourceField[] => {
  return dataSource.fields.filter(field => field.type === type);
};

export const getAggregableFields = (dataSource: DataSource): DataSourceField[] => {
  return dataSource.fields.filter(field => field.aggregations && field.aggregations.length > 0);
};
