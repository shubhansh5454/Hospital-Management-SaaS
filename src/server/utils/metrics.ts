export interface RequestMetricLog {
  timestamp: string;
  method: string;
  url: string;
  statusCode: number;
  duration: number;
}

export interface ErrorMetricLog {
  timestamp: string;
  message: string;
  stack?: string;
  method?: string;
  url?: string;
}

class PerformanceMetricsCollector {
  private totalRequests = 0;
  private statusCodes: Record<number, number> = {};
  private methodCounts: Record<string, number> = {};
  private pathCounts: Record<string, number> = {};
  private recentRequests: RequestMetricLog[] = [];
  private recentErrors: ErrorMetricLog[] = [];
  private totalLatency = 0;
  private maxLatency = 0;
  private slowRequestsCount = 0; // requests taking > 500ms

  public recordRequest(method: string, url: string, statusCode: number, duration: number) {
    this.totalRequests++;
    this.totalLatency += duration;
    
    if (duration > this.maxLatency) {
      this.maxLatency = duration;
    }
    
    if (duration > 500) {
      this.slowRequestsCount++;
    }

    // Status code tracking
    this.statusCodes[statusCode] = (this.statusCodes[statusCode] || 0) + 1;

    // Method tracking
    this.methodCounts[method] = (this.methodCounts[method] || 0) + 1;

    // Clean query params for group path tracking
    const pathOnly = url.split('?')[0];
    this.pathCounts[pathOnly] = (this.pathCounts[pathOnly] || 0) + 1;

    // Rolling request history (limit to 100 logs)
    this.recentRequests.unshift({
      timestamp: new Date().toISOString(),
      method,
      url,
      statusCode,
      duration,
    });
    if (this.recentRequests.length > 100) {
      this.recentRequests.pop();
    }
  }

  public recordError(message: string, stack?: string, method?: string, url?: string) {
    this.recentErrors.unshift({
      timestamp: new Date().toISOString(),
      message,
      stack,
      method,
      url,
    });
    if (this.recentErrors.length > 50) {
      this.recentErrors.pop();
    }
  }

  public getSummary() {
    const avgLatency = this.totalRequests > 0 ? Math.round(this.totalLatency / this.totalRequests) : 0;
    
    // Split status codes into categories
    const status2xx = Object.entries(this.statusCodes)
      .filter(([code]) => code.startsWith('2'))
      .reduce((sum, [_, count]) => sum + count, 0);
    const status3xx = Object.entries(this.statusCodes)
      .filter(([code]) => code.startsWith('3'))
      .reduce((sum, [_, count]) => sum + count, 0);
    const status4xx = Object.entries(this.statusCodes)
      .filter(([code]) => code.startsWith('4'))
      .reduce((sum, [_, count]) => sum + count, 0);
    const status5xx = Object.entries(this.statusCodes)
      .filter(([code]) => code.startsWith('5'))
      .reduce((sum, [_, count]) => sum + count, 0);

    return {
      totalRequests: this.totalRequests,
      averageLatencyMs: avgLatency,
      maxLatencyMs: this.maxLatency,
      slowRequestsCount: this.slowRequestsCount,
      statusDistribution: {
        '2xx': status2xx,
        '3xx': status3xx,
        '4xx': status4xx,
        '5xx': status5xx,
        raw: this.statusCodes
      },
      methodCounts: this.methodCounts,
      topEndpoints: Object.entries(this.pathCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([endpoint, count]) => ({ endpoint, count })),
      recentRequests: this.recentRequests,
      recentErrors: this.recentErrors,
    };
  }
}

export const performanceMetrics = new PerformanceMetricsCollector();
