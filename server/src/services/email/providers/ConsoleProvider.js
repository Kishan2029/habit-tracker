export default class ConsoleProvider {
  get name() {
    return 'console';
  }

  async send({ to, subject }) {
    console.log(`[Email Console] "${subject}" → ${to}`);
    return {};
  }
}
