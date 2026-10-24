/**
 * A ready-made document so a first-time visitor can try Recall without having
 * a file to hand. The company is fictional.
 *
 * Kept as a module rather than a file on disk so it is bundled with the route
 * and needs no output-file tracing on serverless hosts.
 */

export const SAMPLE_DOCUMENT_NAME = 'Sample: Halden & Pike Employee Handbook'

/**
 * Questions shown once the sample is loaded. The last one is deliberately not
 * answered anywhere in the handbook, to show the assistant declining rather
 * than inventing an answer.
 */
export const SAMPLE_QUESTIONS = [
    'How many vacation days do I get in my first year?',
    'Can I work remotely from another country?',
    'What expenses can I claim without approval?',
    'What is the CEO’s salary?',
]

export const SAMPLE_DOCUMENT_CONTENT = `
Halden & Pike Employee Handbook

Welcome
Halden & Pike is a product design and engineering studio of 42 people with offices in Lisbon and Rotterdam. We build software for logistics and healthcare clients. This handbook explains how we work, what you can expect from us, and what we expect from you. It is reviewed every January by the Operations team; the current edition was approved on 15 January. If anything here conflicts with your employment contract, your contract takes precedence.

Working hours
Our core collaboration hours are 10:00 to 15:00 in your office's local time. Outside those hours you can arrange your day as you see fit, provided you work your contracted hours over the week. Full-time employees are contracted for 38 hours per week. We do not expect replies to messages outside your working hours, and managers are asked to schedule non-urgent messages for the next working morning.

Remote work
Every employee may work from home up to three days per week. Teams agree a shared office day so that people who come in are not alone; for most teams this is Tuesday. Working remotely from another country is allowed for up to 30 calendar days per year, and requires written approval from your manager and from Operations at least two weeks in advance, because it can create tax and insurance obligations for both you and the company. Working from a country under international sanctions is never permitted. Laptops must not be left unattended in public places, and client work must not be done over public Wi-Fi without the company VPN.

Vacation and time off
Full-time employees receive 25 vacation days per year, plus the public holidays of the country where their office is located. In your first calendar year, vacation is prorated by the number of full months you are employed; for example, someone who starts on 1 July receives 12.5 days for that year. Up to 5 unused days can be carried over into the following year and must be used by 31 March, after which they expire. Vacation requests of three days or more should be submitted at least two weeks ahead through the HR portal. Between 20 December and 2 January the studio closes, and those working days are drawn from your vacation allowance; if you do not have enough remaining days, the closure is granted as paid leave.

Sick leave
If you are ill, notify your manager before 10:00 on the first day. You do not need a doctor's note for absences of up to three consecutive working days. For longer absences, a note is required from the fourth day. Sick days do not reduce your vacation allowance. We also offer two paid wellbeing days per year, which can be taken without explanation and without advance notice.

Parental leave
Birth parents receive 20 weeks of fully paid leave. Non-birth parents, including adoptive parents, receive 10 weeks of fully paid leave, which can be taken in up to three blocks within the first year. These entitlements are in addition to any statutory leave, and the company pays the difference between statutory benefits and full salary. On return, you can work a reduced schedule of 80 percent at full pay for the first four weeks.

Expenses
You can claim reasonable work expenses without prior approval up to 150 euros per item, as long as you submit a receipt within 30 days through the expenses tool. Anything above 150 euros, and all travel bookings, need approval from your manager before you spend the money. Claims submitted more than 90 days after the purchase will not be reimbursed. Meals while travelling are covered up to 60 euros per day. Alcohol is not reimbursed, except at team events organised by the studio. Every employee also has a home-office budget of 600 euros, available once every three years, for a desk, chair, monitor or similar equipment.

Learning budget
Each employee has an annual learning budget of 1,500 euros for courses, books, conferences and certifications. Up to five working days per year can be used for learning without drawing on vacation. Requests are approved by your manager and should relate to your current role or a role you are working towards. If you leave the company within six months of a course costing more than 1,000 euros, you may be asked to repay half of it.

Equipment
New employees receive a laptop of their choice from a standard list, a monitor, and a headset. Laptops are replaced every three years, or sooner if they fail. Company equipment remains the property of Halden & Pike and must be returned within ten working days of your last day. Personal devices may be used to read email and chat, but client source code and client data must only be stored on company-managed devices.

Security and client data
All accounts must use the company password manager and multi-factor authentication. Client data is classified as confidential by default. It must never be pasted into public AI tools or personal cloud storage. Approved AI tools are listed on the intranet, and they may be used with client data only where the client contract allows it. Suspected security incidents, including a lost laptop or a phishing email you clicked, must be reported to security@haldenpike.example within one hour of noticing. Reporting quickly is always the right decision, and nobody is disciplined for reporting their own mistake.

Performance and growth
We hold two development conversations per year, in March and September. They focus on growth and feedback rather than ratings. Salary reviews happen once a year in April and take into account market data, your role level and your contribution. Our role levels and salary bands for each level are published internally on the intranet, so that everyone can see how levels are defined and what each band pays. Individual salaries are confidential.

Conduct
We expect everyone to treat colleagues, clients and partners with respect. Harassment and discrimination of any kind are not tolerated. Concerns can be raised with your manager, with Operations, or anonymously through the confidential reporting line. Every report is investigated, and retaliation against anyone who raises a concern in good faith is itself a disciplinary matter.

Leaving the company
The notice period is one month during the probation period and two months afterwards, unless your contract says otherwise. Probation lasts four months. Unused vacation days are paid out in your final salary. We hold an exit conversation with everyone who leaves, and we genuinely use what we hear to improve.

Questions
For anything not covered here, ask your manager or write to operations@haldenpike.example.
`.trim()
