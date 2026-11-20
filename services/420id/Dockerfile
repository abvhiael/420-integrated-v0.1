# Build with the repository root as docker context.
FROM golang:1.25-bookworm AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY services/420id ./services/420id
COPY cmd/420id ./cmd/420id
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/420id ./cmd/420id

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /out/420id /usr/local/bin/420id
USER 65532:65532
EXPOSE 10000
ENTRYPOINT ["/usr/local/bin/420id"]
