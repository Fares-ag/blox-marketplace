import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { ErrorOutlined, Refresh } from '@mui/icons-material';
import * as Sentry from '@sentry/react';
import { Button } from '../../core/Button/Button';
import './ErrorBoundary.scss';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
      tags: {
        errorBoundary: true,
      },
    });

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.location.href = '/';
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Box className="error-boundary">
          <Box className="error-content">
            <ErrorOutlined className="error-icon" />
            <Typography variant="h3" className="error-title">
              Something went wrong
            </Typography>
            <Typography variant="body1" className="error-message">
              {this.state.error?.message || 'An unexpected error occurred'}
            </Typography>
            {import.meta.env.DEV && this.state.errorInfo && (
              <Box className="error-details">
                <Typography variant="body2" component="pre">
                  {this.state.error?.stack}
                </Typography>
              </Box>
            )}
            <Button
              variant="primary"
              startIcon={<Refresh />}
              onClick={this.handleReset}
              className="error-button"
            >
              Go to Home
            </Button>
          </Box>
        </Box>
      );
    }

    return this.props.children;
  }
}
