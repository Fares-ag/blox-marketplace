import { Tabs, Tab, type TabsProps } from '@mui/material';
import { bloxTokens } from '../config/blox-tokens';

export function OpsTabs({
  className,
  tabVariant = 'status',
  ...props
}: TabsProps & { tabVariant?: 'status' | 'workspace' }) {
  const wrapperClass = tabVariant === 'workspace' ? 'blox-workspace-tabs' : 'blox-status-tabs';
  return (
    <div className={`${wrapperClass}${className ? ` ${className}` : ''}`}>
      <Tabs
        {...props}
        sx={{
          minHeight: 40,
          '& .MuiTabs-indicator': {
            backgroundColor: bloxTokens.deepGreen,
            height: 3,
            borderRadius: '3px 3px 0 0',
            transition: `left var(--blox-motion-normal) var(--blox-ease-standard), width var(--blox-motion-normal) var(--blox-ease-standard)`,
          },
          '& .MuiTab-root': {
            minHeight: 40,
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.875rem',
            color: bloxTokens.slate,
            transition: `color var(--blox-motion-fast) var(--blox-ease-standard)`,
            '&.Mui-selected': { color: bloxTokens.deepGreen },
          },
          ...props.sx,
        }}
      />
    </div>
  );
}

export { Tab as OpsTab };
