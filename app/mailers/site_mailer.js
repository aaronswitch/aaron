module.exports = {
  exportAs: 'SiteMailer',
  address: 'lab.demokracija.hr',
  from: 'welcome@lab.demokracija.hr',
  subject: 'Aaron',

  peer: function(data) {
    console.log('SITE MAILER PEER:' + JSON.stringify(data));
    data.to = data.To;
    this.mail(data);
  },
  verify: function(data) {
    this.mail(data);
  },
  invite: function(data) {
    this.mail(data);
  },
  resetpassword: function(data) {
    this.mail(data);
  }
}
