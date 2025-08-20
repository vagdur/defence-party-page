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
    };
    success: {
      saved: string;
    };
  };
  form: {
    sections: {
      information: {
        title: string;
        fields: {
          name: {
            label: string;
          };
          phone: {
            label: string;
          };
        };
      };
      relationships: {
        title: string;
        description: string;
      };
    };
    submit: string;
  };
  registrants: {
    title: string;
    empty: string;
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
      validation: "Please provide both name and phone.",
      save: "Failed to save. Please try again.",
      load: "Failed to load registrants"
    },
    success: {
      saved: "Saved! Thank you for registering."
    }
  },
  form: {
    sections: {
      information: {
        title: "Your Information",
        fields: {
          name: {
            label: "Name"
          },
          phone: {
            label: "Phone"
          }
        }
      },
      relationships: {
        title: "Do you know these people?",
        description: "Check the boxes for people you know. This helps us understand the social connections at the party!"
      }
    },
    submit: "Register for Party"
  },
  registrants: {
    title: "All Registrants",
    empty: "No registrations yet."
  }
};
