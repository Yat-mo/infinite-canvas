package middleware

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tigerowo/infinite-canvas/handler"
)

type rateBucket struct {
	count int
	reset time.Time
}

var (
	rateMu      sync.Mutex
	rateBuckets = map[string]*rateBucket{}
)

// RateLimit limits requests per client IP for the given window.
func RateLimit(limit int, window time.Duration) gin.HandlerFunc {
	if limit <= 0 {
		limit = 20
	}
	if window <= 0 {
		window = time.Minute
	}
	return func(c *gin.Context) {
		key := clientIP(c) + "|" + c.FullPath()
		now := time.Now()
		rateMu.Lock()
		bucket, ok := rateBuckets[key]
		if !ok || now.After(bucket.reset) {
			bucket = &rateBucket{count: 0, reset: now.Add(window)}
			rateBuckets[key] = bucket
		}
		bucket.count++
		count := bucket.count
		rateMu.Unlock()
		if count > limit {
			handler.FailWithStatus(c.Writer, http.StatusTooManyRequests, "请求过于频繁，请稍后再试")
			c.Abort()
			return
		}
		c.Next()
	}
}

func clientIP(c *gin.Context) string {
	if xff := strings.TrimSpace(c.GetHeader("X-Forwarded-For")); xff != "" {
		parts := strings.Split(xff, ",")
		if ip := strings.TrimSpace(parts[0]); ip != "" {
			return ip
		}
	}
	if xri := strings.TrimSpace(c.GetHeader("X-Real-IP")); xri != "" {
		return xri
	}
	host, _, err := net.SplitHostPort(strings.TrimSpace(c.Request.RemoteAddr))
	if err == nil && host != "" {
		return host
	}
	return strings.TrimSpace(c.Request.RemoteAddr)
}
