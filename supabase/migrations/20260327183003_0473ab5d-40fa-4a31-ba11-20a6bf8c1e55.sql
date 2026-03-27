-- Create table for A/B test hypotheses
CREATE TABLE public.ab_test_hypotheses (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    problem_identified TEXT NOT NULL,
    hypothesis_improvement TEXT NOT NULL,
    proposed_solution TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'discarded')),
    expected_impact TEXT NOT NULL DEFAULT 'medium' CHECK (expected_impact IN ('low', 'medium', 'high')),
    priority_score INTEGER DEFAULT 0,
    learnings TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add hypothesis_id to ab_tests to link them
ALTER TABLE public.ab_tests 
ADD COLUMN hypothesis_id UUID REFERENCES public.ab_test_hypotheses(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.ab_test_hypotheses ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access (assuming admins have access)
CREATE POLICY "Admins can manage hypotheses" 
ON public.ab_test_hypotheses 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create function to update timestamps
CREATE TRIGGER update_ab_test_hypotheses_updated_at
BEFORE UPDATE ON public.ab_test_hypotheses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some example suggestions/bottlenecks based logic could go here, 
-- but we'll handle dynamic suggestions in the UI based on real data.

-- Add index for better performance
CREATE INDEX idx_ab_test_hypotheses_status ON public.ab_test_hypotheses(status);
