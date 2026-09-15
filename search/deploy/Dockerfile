FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY search ./search
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/search420 ./search/cmd/search420
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/searchsmoke ./search/cmd/searchsmoke
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/searchlivevalidate ./search/cmd/searchlivevalidate

FROM alpine:3.22
RUN addgroup -S search && adduser -S -G search search
COPY --from=build /out/search420 /usr/local/bin/search420
COPY --from=build /out/searchsmoke /usr/local/bin/searchsmoke
COPY --from=build /out/searchlivevalidate /usr/local/bin/searchlivevalidate
USER search
EXPOSE 8421
ENTRYPOINT ["/usr/local/bin/search420"]
