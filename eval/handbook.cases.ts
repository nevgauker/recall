/**
 * Evaluation cases for the sample handbook (lib/sample-document.ts).
 *
 * Because the document is ours, every expected fact is known exactly, so
 * grading is deterministic: an answer passes when it does not decline and
 * matches every `mustInclude` pattern (case-insensitive). No model judges
 * another model's output.
 *
 * Patterns check the fact, not the phrasing — "three|3", not a sentence.
 * When adding a case, quote the handbook line it comes from in `evidence` so a
 * reviewer can check the expectation without opening the document.
 */

export type EvalCase =
    | {
          id: string
          question: string
          expect: 'answer'
          mustInclude: string[]
          evidence: string
      }
    | {
          id: string
          question: string
          expect: 'decline'
          /** Why the handbook cannot answer this. */
          reason: string
      }

export const CASES: EvalCase[] = [
    // --- Direct lookups ---
    {
        id: 'vacation-annual',
        question: 'How many vacation days do full-time employees get per year?',
        expect: 'answer',
        mustInclude: ['\\b25\\b'],
        evidence: 'Full-time employees receive 25 vacation days per year',
    },
    {
        id: 'vacation-carryover',
        question: 'How many unused vacation days can I carry over, and when do they expire?',
        expect: 'answer',
        mustInclude: ['\\b(5|five)\\b', '31 March|March 31'],
        evidence: 'Up to 5 unused days can be carried over ... must be used by 31 March',
    },
    {
        id: 'office-closure',
        question: 'Does the studio close over the holidays?',
        expect: 'answer',
        mustInclude: ['20 December|December 20', '2 January|January 2'],
        evidence: 'Between 20 December and 2 January the studio closes',
    },
    {
        id: 'core-hours',
        question: 'What are the core collaboration hours?',
        expect: 'answer',
        mustInclude: ['10(:00)?', '15(:00)?|3 ?pm'],
        evidence: 'Our core collaboration hours are 10:00 to 15:00',
    },
    {
        id: 'remote-days',
        question: 'How many days a week can I work from home?',
        expect: 'answer',
        mustInclude: ['\\b(3|three)\\b'],
        evidence: 'Every employee may work from home up to three days per week',
    },
    {
        id: 'remote-abroad',
        question: 'Can I work remotely from another country?',
        expect: 'answer',
        mustInclude: ['30 (calendar )?days', 'approv'],
        evidence: 'allowed for up to 30 calendar days per year, and requires written approval',
    },
    {
        id: 'sick-note-short',
        question: 'Do I need a doctor’s note if I’m off sick for two days?',
        expect: 'answer',
        mustInclude: ['\\bno\\b|not (need|required)|don.t need|do not need'],
        evidence: 'You do not need a doctor’s note for absences of up to three consecutive working days',
    },
    {
        id: 'wellbeing-days',
        question: 'How many wellbeing days do we get?',
        expect: 'answer',
        mustInclude: ['\\b(2|two)\\b'],
        evidence: 'We also offer two paid wellbeing days per year',
    },
    {
        id: 'parental-non-birth',
        question: 'How much parental leave does a non-birth parent get?',
        expect: 'answer',
        mustInclude: ['\\b(10|ten) weeks'],
        evidence: 'Non-birth parents, including adoptive parents, receive 10 weeks of fully paid leave',
    },
    {
        id: 'expense-limit',
        question: 'What expenses can I claim without approval?',
        expect: 'answer',
        mustInclude: ['150'],
        evidence: 'without prior approval up to 150 euros per item',
    },
    {
        id: 'expense-receipt-deadline',
        question: 'How long do I have to submit a receipt?',
        expect: 'answer',
        mustInclude: ['\\b30 days'],
        evidence: 'submit a receipt within 30 days through the expenses tool',
    },
    {
        id: 'meal-allowance',
        question: 'How much is covered for meals when travelling?',
        expect: 'answer',
        mustInclude: ['\\b60\\b'],
        evidence: 'Meals while travelling are covered up to 60 euros per day',
    },
    {
        id: 'home-office',
        question: 'Is there a budget for home-office equipment?',
        expect: 'answer',
        mustInclude: ['600', '(3|three) years'],
        evidence: 'a home-office budget of 600 euros, available once every three years',
    },
    {
        id: 'learning-budget',
        question: 'What is the annual learning budget?',
        expect: 'answer',
        mustInclude: ['1,?500'],
        evidence: 'an annual learning budget of 1,500 euros',
    },
    {
        id: 'equipment-return',
        question: 'When do I have to return my laptop after leaving?',
        expect: 'answer',
        mustInclude: ['\\b(10|ten) working days'],
        evidence: 'must be returned within ten working days of your last day',
    },
    {
        id: 'incident-report',
        question: 'I lost my work laptop. How quickly do I need to report it?',
        expect: 'answer',
        mustInclude: ['(one|1) hour'],
        evidence: 'must be reported to security@haldenpike.example within one hour of noticing',
    },
    {
        id: 'salary-review',
        question: 'When do salary reviews happen?',
        expect: 'answer',
        mustInclude: ['April'],
        evidence: 'Salary reviews happen once a year in April',
    },
    {
        id: 'probation-length',
        question: 'How long is the probation period?',
        expect: 'answer',
        mustInclude: ['(4|four) months'],
        evidence: 'Probation lasts four months',
    },

    // --- Needs reasoning over the text, not just lookup ---
    {
        id: 'vacation-prorated-october',
        question: 'If I start on 1 October, how many vacation days do I get for that year?',
        expect: 'answer',
        // 3 full months of 12, of 25 days.
        mustInclude: ['6\\.25'],
        evidence: 'In your first calendar year, vacation is prorated by the number of full months you are employed',
    },
    {
        id: 'sick-note-five-days',
        question: 'I was sick for five days. Do I need a doctor’s note?',
        expect: 'answer',
        mustInclude: ['\\byes\\b|required|need (a|one)|fourth'],
        evidence: 'For longer absences, a note is required from the fourth day',
    },
    {
        id: 'expense-over-limit',
        question: 'Can I buy a 400 euro monitor for a client project and claim it afterwards?',
        expect: 'answer',
        mustInclude: ['approv'],
        evidence: 'Anything above 150 euros ... need approval from your manager before you spend the money',
    },
    {
        id: 'notice-after-probation',
        question: 'I’ve been here a year. What notice do I have to give?',
        expect: 'answer',
        mustInclude: ['(2|two)[ -]months?'],
        evidence: 'one month during the probation period and two months afterwards',
    },
    {
        id: 'client-data-ai',
        question: 'Can I paste client data into a public AI chatbot?',
        expect: 'answer',
        mustInclude: ['\\bno\\b|never|not (allowed|permitted)|must not|should not|cannot'],
        evidence: 'It must never be pasted into public AI tools or personal cloud storage',
    },

    // --- Not in the handbook: the right answer is to decline ---
    {
        id: 'ceo-salary',
        question: 'What is the CEO’s salary?',
        expect: 'decline',
        reason: 'Individual salaries are confidential and not listed; bands are on the intranet, not here.',
    },
    {
        id: 'dress-code',
        question: 'Is there a dress code?',
        expect: 'decline',
        reason: 'The handbook does not mention dress.',
    },
    {
        id: 'pension',
        question: 'How much does the company contribute to my pension?',
        expect: 'decline',
        reason: 'Pensions are not covered.',
    },
    {
        id: 'new-york-office',
        question: 'How many people work in the New York office?',
        expect: 'decline',
        reason: 'False premise: offices are Lisbon and Rotterdam only.',
    },
    {
        id: 'revenue',
        question: 'What was the company’s revenue last year?',
        expect: 'decline',
        reason: 'Financials are not covered.',
    },
    {
        id: 'gym',
        question: 'Do we get a gym membership?',
        expect: 'decline',
        reason: 'No such benefit is listed.',
    },
]
