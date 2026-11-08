import { Compass } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';

export function NotFound() {
  return (
    <EmptyState
      icon={Compass}
      title="Off the map"
      actions={
        <Button asChild>
          <Link to="/">Back to the dashboard</Link>
        </Button>
      }
    >
      This page doesn’t exist. It may have moved, or the link is mistyped.
    </EmptyState>
  );
}
