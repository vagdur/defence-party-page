export interface HomeContent {
  meta: {
    title: string;
    description: string;
  };
  page: {
    title: string;
    subtitle: string;
  };
  partyDetails: {
    title: string;
    description: string;
    date: string;
    time: string;
    location: string;
    address: string;
    dressCode: string;
  };
  messages: {
    error: {
      validation: string;
      save: string;
      load: string;
      duplicateName: string;
      duplicateEmail: string;
      duplicateNameAndEmail: string;
      fullyBooked: string;
    };
    success: {
      saved: string;
    };
  };
  fullyBooked: {
    title: string;
    message: string;
    contactInfo: string;
  };
  payment: {
    title: string;
    mobile: {
      buttonText: string;
      fallbackText: string;
    };
    desktop: {
      title: string;
      fallbackText: string;
    };
  };
  form: {
    sections: {
      information: {
        title: string;
        fields: {
          firstName: {
            label: string;
          };
          lastName: {
            label: string;
          };
          email: {
            label: string;
          };
          dietary: {
            label: string;
            options: {
              none: string;
              pescetarian: string;
              vegan: string;
              other: string;
            };
            otherPlaceholder: string;
          };
          alcohol: {
            label: string;
            yes: string;
            no: string;
            note: string;
          };
          speech: {
            label: string;
          };
          languages: {
            label: string;
            placeholder: string;
            addButton: string;
          };
          topics: {
            label: string;
            placeholder: string;
            addButton: string;
          };
        };
      };
      relationships: {
        title: string;
        description: string;
        subsections: {
          languages: string;
          topics: string;
          familiarity: string;
        };
        scale: {
          left: string;
          middle: string;
          right: string;
        };
      };
    };
    submit: string;
    disclaimer: string;
    researchConsent: {
      label: string;
    };
  };
}

export const homeContent: HomeContent = {
  meta: {
    title: "Defence Party Registration",
    description: "Register for the Defence Party!"
  },
  page: {
    title: "Defence Party Registration",
    subtitle: "Welcome to the Defence Party registration page!"
  },
  partyDetails: {
    title: "🎉 Party Details",
    description: "It is time to celebrate the end of my PhD! As is customary, this is to be done with a party. There will be a three-course meal, and then time for dancing or talking or drinking, or any combination thereof.",
    date: "Friday, September 19th, 2025",
    time: "6:00 PM - When you get tired of me (Or 01:00 AM, whichever comes first)",
    location: "Gamla Stadshotellet",
    address: "Drottninggatan 9, Uppsala",
    dressCode: "Udda kavaj/smart casual (If you show up in full evening dress, I will make fun of you.)"
  },
  messages: {
    error: {
      validation: "Please provide first name, last name, email, dietary preferences, and alcohol preference.",
      save: "Failed to save. Please try again.",
      load: "Failed to load registrants",
      duplicateName: "A registrant with this name already exists.",
      duplicateEmail: "A registrant with this email address already exists.",
      duplicateNameAndEmail: "A registrant with this name and email address already exists.",
      fullyBooked: "Sorry, this event is now fully booked."
    },
    success: {
      saved: "Saved! Thank you for registering."
    }
  },
  fullyBooked: {
    title: "Fully Booked",
    message: "Sorry, but it appears we are out of seats!",
    contactInfo: "If you really want to come, contact me and maybe I will be able to shake a seat out of the couch cushions for you."
  },
  payment: {
    title: "Pay for the meal via Swish",
    mobile: {
      buttonText: "Open Swish Payment",
      fallbackText: "Or send {amount} {currency} to {phoneNumber} via Swish"
    },
    desktop: {
      title: "Pay for the meal via Swish by scanning the QR code:",
      fallbackText: "Or send {amount} {currency} to {phoneNumber} via Swish"
    }
  },
  form: {
    sections: {
      information: {
        title: "Your Information",

        fields: {
          firstName: {
            label: "First name"
          },
          lastName: {
            label: "Last name"
          },
          email: {
            label: "Email"
          },
          dietary: {
            label: "Dietary Preferences",
            options: {
              none: "None",
              pescetarian: "Pescetarian",
              vegan: "Vegan",
              other: "Other"
            },
            otherPlaceholder: "Please specify..."
          },
          alcohol: {
            label: "Do you want alcohol?",
            yes: "Yes",
            no: "No",
            note: "Alcohol costs {alcoholCost}:- extra."
          },
          speech: {
            label: "I would like to give a speech or do some other funny or serious thing."
          },
          languages: {
            label: "What languages are you comfortable having a conversation in? (You can add more by typing in the text box and clicking the button.)",
            placeholder: "Enter a language...",
            addButton: "Add Language"
          },
          topics: {
            label: "What topics would you want to talk about over dinner? (You can add more by typing in the text box and clicking the button.)",
            placeholder: "Enter a topic...",
            addButton: "Add Topic"
          }
        }
      },
      relationships: {
        title: "Social Network & Interests",
        description: "It wouldn't be a defence party for a graph theory PhD without a few graphs. Please use these sliders to indicate how well you know the other participants - we will then use this information to assign seating at the party! (You may or may not be forced to listen to an explanation of the algorithm I used for this.)",
        subsections: {
          languages: "Languages",
          topics: "Discussion Topics",
          familiarity: "Familiarity with Other Participants"
        },
        scale: {
          left: "I don't know this person",
          middle: "An acquaintance",
          right: "We are close"
        }
      }
    },
    submit: "Register for Party",
    disclaimer: "By submitting, you approve the use of your data for assigning seating at the party, as well as the display of anonymized data at the presentation at the defence.",
    researchConsent: {
      label: "I additionally consent to my social network data being released in anonymized form for research."
    }
  }
};
