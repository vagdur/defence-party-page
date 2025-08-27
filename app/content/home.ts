export interface HomeContent {
  meta: {
    title: string;
    description: string;
  };
  page: {
    title: string;
    subtitle: string;
  };
  messages: {
    error: {
      validation: string;
      save: string;
      load: string;
      duplicateName: string;
      duplicateEmail: string;
      duplicateNameAndEmail: string;
    };
    success: {
      saved: string;
    };
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
        subheadings?: {
          personal: string;
          social: string;
        };
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
  messages: {
    error: {
      validation: "Please provide first name, last name, email, dietary preferences, and alcohol preference.",
      save: "Failed to save. Please try again.",
      load: "Failed to load registrants",
      duplicateName: "A registrant with this name already exists.",
      duplicateEmail: "A registrant with this email address already exists.",
      duplicateNameAndEmail: "A registrant with this name and email address already exists."
    },
    success: {
      saved: "Saved! Thank you for registering."
    }
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
        subheadings: {
          personal: "Personal data",
          social: "Social network data",
        },
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
          languages: {
            label: "Languages you are comfortable having a conversation in",
            placeholder: "Enter a language...",
            addButton: "Add Language"
          },
          topics: {
            label: "Conversation topics of interest",
            placeholder: "Enter a topic...",
            addButton: "Add Topic"
          }
        }
      },
      relationships: {
        title: "Do you know these people?",
        description: "Check the boxes for people you know. This helps us understand the social connections at the party!",
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
