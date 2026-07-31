module.exports = async function globalTeardown() {
  const container = global.__PG_TEST_CONTAINER__;

  if (container) {
    await container.stop();
  }
};
