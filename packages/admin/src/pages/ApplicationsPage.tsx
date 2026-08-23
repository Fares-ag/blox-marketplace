import { ApplicationsList } from '@drivemarket/shared';

export function ApplicationsPage() {
  return (
    <ApplicationsList
      audience="admin"
      basePath="/main/applications"
      createPath="/main/applications/new"
    />
  );
}
