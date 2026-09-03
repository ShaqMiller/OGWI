import { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma.js';

/**
 * Fake demo content so the scheduler, mastery, adaptive, composition and
 * economy modules have something real to exercise end to end. This is NOT
 * the "first vertical" - that's still an open decision (Doc 2 Part D #1).
 * This is obviously-fake test content, clearly labelled as such, safe to
 * delete once real content exists.
 *
 * Idempotent per qualification: skips any slug that already exists.
 */

async function seedQualificationIfMissing(
  slug: string,
  data: Omit<Prisma.QualificationCreateInput, 'slug'>,
): Promise<void> {
  const existing = await prisma.qualification.findUnique({ where: { slug } });

  if (existing) {
    console.log(`Seed: "${slug}" already exists, skipping.`);
    return;
  }

  await prisma.qualification.create({ data: { slug, ...data } });
  console.log(`Seed: created "${slug}" with demo content.`);
}

async function main() {
  await seedQualificationIfMissing('demo-cert', {
    name: '[TEST CONTENT] Demo IT Fundamentals',
    contentGraphVersion: 'seed-1',
    passMark: 0.7,
    modules: {
      create: [
        {
          name: 'Networking Basics',
          order: 0,
          blueprintWeight: 1.0,
          topics: {
            create: [
              {
                name: 'IP Addressing',
                order: 0,
                hasActivitySlot: true,
                objectives: {
                  create: [
                    {
                      name: 'Recognise IPv4 address classes',
                      order: 0,
                      kind: 'FACT_HEAVY',
                      keyPoints: {
                        create: [
                          {
                            plainName: 'IP addresses are grouped into classes (A to E)',
                            cueQuestion: 'What determines which class an IP address belongs to?',
                            tier: 'CRITICAL',
                          },
                          {
                            plainName: 'Class C addresses start with 192 to 223',
                            cueQuestion: "What's the first-octet range for Class C addresses?",
                            tier: 'SUPPORTING',
                          },
                        ],
                      },
                      knowledgeItems: {
                        create: [
                          {
                            renderings: {
                              create: [
                                {
                                  role: 'BASE',
                                  format: 'MULTIPLE_CHOICE',
                                  content: {
                                    prompt: 'Which class does the IP address 192.168.1.1 belong to?',
                                    options: ['Class A', 'Class B', 'Class C', 'Class D'],
                                    correctOptionIndex: 2,
                                  },
                                },
                              ],
                            },
                          },
                          {
                            renderings: {
                              create: [
                                {
                                  role: 'BASE',
                                  format: 'MULTIPLE_CHOICE',
                                  content: {
                                    prompt: 'How many bits make up an IPv4 address?',
                                    options: ['16', '32', '64', '128'],
                                    correctOptionIndex: 1,
                                  },
                                },
                              ],
                            },
                          },
                        ],
                      },
                    },
                    {
                      name: 'Explain why subnetting exists',
                      order: 1,
                      kind: 'CONCEPTUAL',
                      keyPoints: {
                        create: [
                          {
                            plainName: 'Subnetting divides a network into smaller pieces',
                            cueQuestion: 'What does subnetting actually do to a network?',
                            tier: 'CRITICAL',
                          },
                          {
                            plainName: 'Subnetting reduces broadcast traffic',
                            cueQuestion: 'Why does dividing a network reduce broadcast traffic?',
                            tier: 'SUPPORTING',
                          },
                        ],
                      },
                      knowledgeItems: {
                        create: [
                          {
                            renderings: {
                              create: [
                                {
                                  role: 'BASE',
                                  format: 'MULTIPLE_CHOICE',
                                  content: {
                                    prompt: 'What is the main reason a large network gets divided into subnets?',
                                    options: [
                                      'To make IP addresses shorter',
                                      'To reduce broadcast traffic and organise the network',
                                      'To make the network wireless',
                                      'To increase the number of MAC addresses',
                                    ],
                                    correctOptionIndex: 1,
                                  },
                                },
                              ],
                            },
                          },
                        ],
                      },
                    },
                    {
                      name: 'Recognise reserved and private IP ranges',
                      order: 2,
                      kind: 'FACT_HEAVY',
                      keyPoints: {
                        create: [
                          {
                            plainName: '192.168.0.0/16 is a private address range',
                            cueQuestion: 'Which range is reserved for private home networks?',
                            tier: 'CRITICAL',
                          },
                          {
                            plainName: "Private addresses aren't routed on the public internet",
                            cueQuestion: "Why can't a private IP address be reached directly from the internet?",
                            tier: 'SUPPORTING',
                          },
                        ],
                      },
                      knowledgeItems: {
                        create: [
                          {
                            renderings: {
                              create: [
                                {
                                  role: 'BASE',
                                  format: 'MULTIPLE_CHOICE',
                                  content: {
                                    prompt: 'Which of these is a private IPv4 address range?',
                                    options: ['8.8.8.0/24', '192.168.0.0/16', '1.1.1.0/24', '203.0.113.0/24'],
                                    correctOptionIndex: 1,
                                  },
                                },
                              ],
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
              {
                name: 'The OSI Model',
                order: 1,
                hasActivitySlot: true,
                objectives: {
                  create: [
                    {
                      name: 'Recall the seven OSI layers in order',
                      order: 0,
                      kind: 'FACT_HEAVY',
                      keyPoints: {
                        create: [
                          {
                            plainName:
                              'The seven layers are Physical, Data Link, Network, Transport, Session, Presentation, Application',
                            cueQuestion: 'Can you list the seven OSI layers in order?',
                            tier: 'CRITICAL',
                          },
                          {
                            plainName: 'The Data Link layer sits directly above Physical',
                            cueQuestion: 'What layer comes right after Physical?',
                            tier: 'SUPPORTING',
                          },
                        ],
                      },
                      knowledgeItems: {
                        create: [
                          {
                            renderings: {
                              create: [
                                {
                                  role: 'BASE',
                                  format: 'MULTIPLE_CHOICE',
                                  content: {
                                    prompt: 'Which OSI layer is directly above the Physical layer?',
                                    options: ['Network', 'Data Link', 'Transport', 'Session'],
                                    correctOptionIndex: 1,
                                  },
                                },
                              ],
                            },
                          },
                          {
                            renderings: {
                              create: [
                                {
                                  role: 'BASE',
                                  format: 'MULTIPLE_CHOICE',
                                  content: {
                                    prompt: 'Which layer is responsible for routing between networks?',
                                    options: ['Data Link', 'Network', 'Session', 'Presentation'],
                                    correctOptionIndex: 1,
                                  },
                                },
                              ],
                            },
                          },
                        ],
                      },
                    },
                    {
                      name: 'Explain what makes the OSI model useful',
                      order: 1,
                      kind: 'CONCEPTUAL',
                      keyPoints: {
                        create: [
                          {
                            plainName: 'It isolates problems to a single layer',
                            cueQuestion: 'Why does splitting networking into layers help troubleshooting?',
                            tier: 'CRITICAL',
                          },
                          {
                            plainName: 'It gives engineers a shared vocabulary',
                            cueQuestion: 'Why is having a shared model useful across different teams?',
                            tier: 'SUPPORTING',
                          },
                        ],
                      },
                      knowledgeItems: {
                        create: [
                          {
                            renderings: {
                              create: [
                                {
                                  role: 'BASE',
                                  format: 'MULTIPLE_CHOICE',
                                  content: {
                                    prompt: 'Why do engineers find the OSI model useful when troubleshooting?',
                                    options: [
                                      'It tells you which cable to buy',
                                      'It breaks networking into layers so a problem can be isolated to one layer',
                                      'It replaces the need for IP addresses',
                                      'It is required by law in most countries',
                                    ],
                                    correctOptionIndex: 1,
                                  },
                                },
                              ],
                            },
                          },
                        ],
                      },
                    },
                    {
                      name: 'Explain why layers only talk to their neighbours',
                      order: 2,
                      kind: 'CONCEPTUAL',
                      keyPoints: {
                        create: [
                          {
                            plainName: 'Each layer only depends on the one directly below it',
                            cueQuestion: 'What does each OSI layer actually depend on?',
                            tier: 'CRITICAL',
                          },
                          {
                            plainName: 'This keeps layers independent so they can change separately',
                            cueQuestion: 'Why does that dependency design matter when making changes?',
                            tier: 'SUPPORTING',
                          },
                        ],
                      },
                      knowledgeItems: {
                        create: [
                          {
                            renderings: {
                              create: [
                                {
                                  role: 'BASE',
                                  format: 'MULTIPLE_CHOICE',
                                  content: {
                                    prompt: 'Why does each OSI layer only communicate directly with the layers immediately above and below it?',
                                    options: [
                                      'It is a legal requirement',
                                      'It keeps each layer independent, so one can change without breaking the others',
                                      'It makes cables shorter',
                                      'It is only true for wireless networks',
                                    ],
                                    correctOptionIndex: 1,
                                  },
                                },
                              ],
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  });

  await seedQualificationIfMissing('demo-pm-basics', {
    name: '[TEST CONTENT] Demo Project Management Basics',
    contentGraphVersion: 'seed-1',
    passMark: 0.65,
    modules: {
      create: [
        {
          name: 'PM Fundamentals',
          order: 0,
          blueprintWeight: 1.0,
          topics: {
            create: [
              {
                name: 'The Project Lifecycle',
                order: 0,
                hasActivitySlot: true,
                objectives: {
                  create: [
                    {
                      name: 'Recall the standard project lifecycle phases',
                      order: 0,
                      kind: 'FACT_HEAVY',
                      knowledgeItems: {
                        create: [
                          {
                            renderings: {
                              create: [
                                {
                                  role: 'BASE',
                                  format: 'MULTIPLE_CHOICE',
                                  content: {
                                    prompt: 'Which phase comes right after "Planning" in the standard project lifecycle?',
                                    options: ['Closing', 'Initiation', 'Execution', 'Monitoring'],
                                    correctOptionIndex: 2,
                                  },
                                },
                              ],
                            },
                          },
                          {
                            renderings: {
                              create: [
                                {
                                  role: 'BASE',
                                  format: 'MULTIPLE_CHOICE',
                                  content: {
                                    prompt: 'What is typically produced at the end of the Initiation phase?',
                                    options: [
                                      'The final deliverable',
                                      'A project charter',
                                      'A lessons-learned report',
                                      'The team’s timesheets',
                                    ],
                                    correctOptionIndex: 1,
                                  },
                                },
                              ],
                            },
                          },
                        ],
                      },
                    },
                    {
                      name: 'Recognise common project constraints',
                      order: 1,
                      kind: 'FACT_HEAVY',
                      knowledgeItems: {
                        create: [
                          {
                            renderings: {
                              create: [
                                {
                                  role: 'BASE',
                                  format: 'MULTIPLE_CHOICE',
                                  content: {
                                    prompt: 'Which three constraints make up the classic "iron triangle" of project management?',
                                    options: [
                                      'Scope, time, cost',
                                      'Risk, quality, staffing',
                                      'Budget, staffing, tools',
                                      'Scope, risk, communication',
                                    ],
                                    correctOptionIndex: 0,
                                  },
                                },
                              ],
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
              {
                name: 'Stakeholder Management',
                order: 1,
                hasActivitySlot: true,
                objectives: {
                  create: [
                    {
                      name: 'Explain why stakeholder mapping matters',
                      order: 0,
                      kind: 'CONCEPTUAL',
                      knowledgeItems: {
                        create: [
                          {
                            renderings: {
                              create: [
                                {
                                  role: 'BASE',
                                  format: 'MULTIPLE_CHOICE',
                                  content: {
                                    prompt: 'Why do project managers map stakeholders by "interest" and "influence" early on?',
                                    options: [
                                      'It is required for the project budget spreadsheet',
                                      'It helps decide who needs frequent updates versus who just needs to be informed',
                                      'It determines who gets paid first',
                                      'It replaces the need for a project charter',
                                    ],
                                    correctOptionIndex: 1,
                                  },
                                },
                              ],
                            },
                          },
                        ],
                      },
                    },
                    {
                      name: 'Explain why scope creep is risky',
                      order: 1,
                      kind: 'CONCEPTUAL',
                      knowledgeItems: {
                        create: [
                          {
                            renderings: {
                              create: [
                                {
                                  role: 'BASE',
                                  format: 'MULTIPLE_CHOICE',
                                  content: {
                                    prompt: 'What is the main risk of letting "scope creep" go unmanaged?',
                                    options: [
                                      'The project finishes early',
                                      'Extra unplanned work erodes the original time and cost estimates',
                                      'It only affects the design team',
                                      'It has no real effect if the client is happy',
                                    ],
                                    correctOptionIndex: 1,
                                  },
                                },
                              ],
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
