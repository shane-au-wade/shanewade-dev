import * as React from "react";

// <Setup Blueprint>
import "@blueprintjs/core/lib/css/blueprint.css";
import "@blueprintjs/icons/lib/css/blueprint-icons.css";

import {
  Button,
  Card,
  ControlGroup,
  FormGroup,
  Icon,
  InputGroup,
} from "@blueprintjs/core";

export default function FormCard(props: {}) {
  const [isPasswordHidden, setIsPasswordHidden] = React.useState(true);

  return (
    <Card style={{ maxWidth: "300px", margin: "0 auto" }}>
      <FormGroup label="Email">
        <InputGroup
          leftIcon={"envelope"}
          onValueChange={(value) => {
            console.log("email", value);
          }}
        />
      </FormGroup>

      <FormGroup label="Password">
        <InputGroup
          type={isPasswordHidden ? "password" : "text"}
          leftElement={isPasswordHidden
            ? (
              <Icon
                icon="lock"
                onClick={() => {
                  setIsPasswordHidden(false);
                }}
              >
              </Icon>
            )
            : (
              <Icon
                icon="unlock"
                onClick={() => {
                  setIsPasswordHidden(true);
                }}
              >
              </Icon>
            )}
        />
      </FormGroup>

      <ControlGroup
        style={{
          flexDirection: "row-reverse",
          gap: "4px",
        }}
      >
        <Button
          intent="primary"
          onClick={() => {
            console.log("testing");
          }}
        >
          Submit
        </Button>
        <Button intent="none">Cancel</Button>
      </ControlGroup>
    </Card>
  );
}
