# Testing

All connectors are enabled by default in the Fireproof test suite. Before running the tests, you need to set up the connector servers for PartyKit and Netlify:
```console
$ pnpm setup-connector-servers
```

To run tests for all connectors:

```console
$ pnpm test-connectors
```

To run tests for a single connector, you can use the Vitest workspace configuration. For example, to run tests for the PartyKit connector only:

```console
$ pnpm test-connectors --project partykit
```

To run a single test by its full name, you can use the `-t` flag followed by the test name in quotes. For example:

```console
$ pnpm test-connectors --project partykit -t "should sync to an empty db"
```
