FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY explorer ./explorer
COPY indexer ./indexer
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/explorer420 ./explorer/cmd/explorer420
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/explorersmoke ./explorer/cmd/explorersmoke
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/explorerlivevalidate ./explorer/cmd/explorerlivevalidate

FROM alpine:3.22
RUN addgroup -S explorer && adduser -S -G explorer explorer
COPY --from=build /out/explorer420 /usr/local/bin/explorer420
COPY --from=build /out/explorersmoke /usr/local/bin/explorersmoke
COPY --from=build /out/explorerlivevalidate /usr/local/bin/explorerlivevalidate
USER explorer
EXPOSE 8420
ENTRYPOINT ["/usr/local/bin/explorer420"]
