FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY search ./search
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/search420 ./search/cmd/search420

FROM alpine:3.22
RUN addgroup -S search && adduser -S -G search search
COPY --from=build /out/search420 /usr/local/bin/search420
USER search
EXPOSE 8421
ENTRYPOINT ["/usr/local/bin/search420"]
