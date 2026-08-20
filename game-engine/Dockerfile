FROM golang:1.27-alpine AS builder

WORKDIR /app

# Copy go mod file(s)
COPY go.mod ./
# COPY go.sum ./

# Download all dependencies.
RUN go mod download

# Copy the source code
COPY . .

# Build the Go app
RUN CGO_ENABLED=0 GOOS=linux go build -o engine ./cmd/server

# Start a new stage from scratch
FROM alpine:latest  

# Copy the Pre-built binary file from the previous stage
COPY --from=builder /app/engine /engine

# Command to run the executable
ENTRYPOINT ["/engine"]
