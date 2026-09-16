FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/analytics420 ./analytics/cmd/analytics420

FROM alpine:3.22
RUN addgroup -S analytics && adduser -S -G analytics analytics
USER analytics
COPY --from=build /out/analytics420 /usr/local/bin/analytics420
EXPOSE 8424
ENTRYPOINT ["/usr/local/bin/analytics420"]
